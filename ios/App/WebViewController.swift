import UIKit
import WebKit
import UserNotifications
import StoreKit

/// Shows Scales and answers what it asks of the phone: reminders, the badge, haptics, downloads, and
/// Scales Plus through StoreKit (1.72.0).
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    private let home = URL(string: "https://scales.tangomike.app/app/?native=1")!
    private var web: WKWebView!
    private var ready = false          // Scales has started and can take scripts
    private var queued: [String] = []  // scripts waiting for that
    static let plusID = "com.grahamdeno.scales.plus.yearly"
    private var storeUpdates: Task<Void, Never>?

    deinit { storeUpdates?.cancel() }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let content = WKUserContentController()
        content.add(WeakHandler(self), name: "scales")
        content.addUserScript(WKUserScript(source: "window.scalesNative = { version: 1, platform: 'ios' };",
                                           injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = content

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.isOpaque = false
        // The smoke band (1.75.0), in every look, so nothing flashes while Scales loads.
        web.backgroundColor = UIColor(red: 0xDC / 255, green: 0xD9 / 255, blue: 0xD3 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
        web.load(URLRequest(url: home))
        // Renewals, refunds and purchases made elsewhere (another device, Ask to Buy) arrive here.
        storeUpdates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                await self?.sendPlus()
            }
        }
    }

    /// Run a script in Scales now, or once it has started.
    func run(_ script: String) {
        guard ready else { queued.append(script); return }
        web.evaluateJavaScript(script, completionHandler: nil)
    }

    // MARK: Messages from Scales

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            ready = true
            queued.forEach { web.evaluateJavaScript($0, completionHandler: nil) }
            queued.removeAll()
            Task { await sendPlus() }
        case "plus":
            Task { await sendPlus() }
        case "purchase":
            Task { await purchase() }
        case "restore":
            Task { await restore() }
        case "manage":
            Task {
                if let scene = view.window?.windowScene { try? await AppStore.showManageSubscriptions(in: scene) }
                await sendPlus()
            }
        case "schedule":
            schedule(body["items"] as? [[String: Any]] ?? [])
        case "unschedule":
            clearReminders()
        case "badge":
            setBadge(body["count"] as? Int ?? 0)
        case "haptic":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        default:
            break
        }
    }

    /// Reminders, scheduled on the phone: no server. Scales sends the next week of them, each with its own
    /// words and badge count, and sends them again whenever something changes, so the list replaces the old one.
    private func schedule(_ items: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            let state = granted ? "granted" : "denied"
            DispatchQueue.main.async { self.run("window.scalesPermission && window.scalesPermission('\(state)')") }
            guard granted else { return }
            center.getPendingNotificationRequests { pending in
                center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("scales-") })
                for item in items {
                    guard let id = item["id"] as? String, let at = item["at"] as? Double else { continue }
                    let when = Date(timeIntervalSince1970: at / 1000)
                    guard when > Date() else { continue }
                    let content = UNMutableNotificationContent()
                    content.title = item["title"] as? String ?? "Scales"
                    content.body = item["body"] as? String ?? ""
                    content.sound = .default
                    if let badge = item["badge"] as? Int { content.badge = NSNumber(value: badge) }
                    let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: when)
                    center.add(UNNotificationRequest(identifier: "scales-\(id)", content: content,
                                                     trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
                }
            }
        }
    }

    private func clearReminders() {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("scales-") })
        }
        setBadge(0)
    }

    private func setBadge(_ count: Int) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized else { return }
            UNUserNotificationCenter.current().setBadgeCount(max(0, count)) { _ in }
        }
    }

    // MARK: Scales Plus

    /// Tells Scales where Plus stands: whether it is active, the App Store's signed record of it (sent with
    /// each AI request and checked by the server), the price, and the free trial if this Apple Account can
    /// still have one. note says how a purchase or restore just ended.
    private func sendPlus(note: String? = nil) async {
        var state: [String: Any] = ["active": false]
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.productID == Self.plusID, t.revocationDate == nil else { continue }
            state["active"] = true
            state["jws"] = result.jwsRepresentation
            if let end = t.expirationDate { state["expires"] = end.timeIntervalSince1970 * 1000 }
            state["trial"] = t.offerType == .introductory
        }
        if let product = try? await Product.products(for: [Self.plusID]).first {
            state["price"] = product.displayPrice
            if let sub = product.subscription {
                if await sub.isEligibleForIntroOffer, let offer = sub.introductoryOffer, offer.paymentMode == .freeTrial {
                    state["trialDays"] = Self.days(offer.period)
                }
                if let statuses = try? await sub.status {
                    for status in statuses {
                        if case .verified(let renewal) = status.renewalInfo, renewal.currentProductID == Self.plusID {
                            state["renews"] = renewal.willAutoRenew
                        }
                    }
                }
            }
        }
        if let note { state["note"] = note }
        guard let data = try? JSONSerialization.data(withJSONObject: state),
              let json = String(data: data, encoding: .utf8) else { return }
        run("window.scalesStore && window.scalesStore(\(json))")
    }

    private static func days(_ period: Product.SubscriptionPeriod) -> Int {
        switch period.unit {
        case .day: return period.value
        case .week: return period.value * 7
        case .month: return period.value * 30
        case .year: return period.value * 365
        @unknown default: return period.value
        }
    }

    private func purchase() async {
        guard let product = try? await Product.products(for: [Self.plusID]).first else {
            await sendPlus(note: "unavailable"); return
        }
        do {
            switch try await product.purchase() {
            case .success(let result):
                if case .verified(let t) = result { await t.finish(); await sendPlus(note: "bought") }
                else { await sendPlus(note: "failed") }
            case .pending:
                await sendPlus(note: "pending")
            case .userCancelled:
                await sendPlus(note: "cancelled")
            @unknown default:
                await sendPlus()
            }
        } catch {
            await sendPlus(note: "failed")
        }
    }

    private func restore() async {
        do { try await AppStore.sync(); await sendPlus(note: "restored") }
        catch { await sendPlus(note: "failed") }
    }

    // MARK: Links and downloads

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if action.shouldPerformDownload { return .download }
        let scheme = url.scheme ?? ""
        if ["blob", "data", "about"].contains(scheme) { return .allow }
        if action.targetFrame?.isMainFrame == false { return .allow }
        if url.host == home.host && url.path.hasPrefix("/app") { return .allow }
        // Everything else (Wikiquote, the privacy policy, mail) opens in its own app or Safari.
        await UIApplication.shared.open(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        response.canShowMIMEType ? .allow : .download
    }

    /// target="_blank" links open outside the app.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    private var downloadURL: URL?
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
        try? FileManager.default.removeItem(at: url)
        downloadURL = url
        return url
    }

    /// A finished download (a backup, a CSV) goes to the share sheet: Save to Files, Mail.
    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadURL else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        present(sheet, animated: true)
    }

    /// If the page dies in the background, start it again.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        ready = false
        webView.reload()
    }
}

/// Keeps the message handler from holding the controller forever.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}
