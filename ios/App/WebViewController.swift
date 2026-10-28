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
        NotificationCenter.default.addObserver(forName: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.sendA11y() }
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
            sendIcon(); sendA11y()
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
        case "icon":
            // Automatic is the main icon, which follows the Home Screen's Light, Dark or Tinted style.
            // Light and Black stay fixed (1.80.1). iOS says the icon changed itself.
            let pick = body["name"] as? String
            let name: String? = pick == "light" ? "AppIcon-Light" : pick == "black" ? "AppIcon-Black" : nil
            guard UIApplication.shared.supportsAlternateIcons, UIApplication.shared.alternateIconName != name else { sendIcon(); return }
            UIApplication.shared.setAlternateIconName(name) { _ in DispatchQueue.main.async { self.sendIcon() } }
        case "save":
            save(json: body["json"] as? String ?? "", day: body["day"] as? String ?? "")
        default:
            break
        }
    }

    /// Whether VoiceOver is on (1.81.0): the quiet fade never dims the screen for someone who isn't looking at it.
    private func sendA11y() {
        run("window.scalesA11y && window.scalesA11y({ voiceOver: \(UIAccessibility.isVoiceOverRunning) })")
    }

    /// Which icon is on the Home Screen, for the choice in Settings.
    private func sendIcon() {
        let n = UIApplication.shared.alternateIconName
        let on = n == "AppIcon-Light" ? "light" : n == "AppIcon-Black" ? "black" : "auto"
        run("window.scalesIcon && window.scalesIcon('\(on)')")
    }

    /// Daily save (1.77.0): Scales sends everything as one JSON file and it is written without asking, as
    /// "Scales backup.json" plus a dated copy (the last 14 kept). It goes to iCloud Drive, Scales, when the app
    /// has an iCloud container (iCloud.com.grahamdeno.scales from 1.77.1, when the person is signed in to iCloud),
    /// otherwise to Files, On My iPhone, Scales (also in the phone's iCloud Backup).
    private func save(json: String, day: String) {
        guard !json.isEmpty else { return }
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            var place = "files"
            var dir = fm.urls(for: .documentDirectory, in: .userDomainMask).first
            if let cloud = fm.url(forUbiquityContainerIdentifier: nil) { dir = cloud.appendingPathComponent("Documents"); place = "icloud" }
            guard let folder = dir else { return }
            try? fm.createDirectory(at: folder, withIntermediateDirectories: true)
            let data = Data(json.utf8)
            let ok = (try? data.write(to: folder.appendingPathComponent("Scales backup.json"), options: .atomic)) != nil
            let stamp = String(day.filter { $0.isNumber || $0 == "-" }.prefix(10))
            if ok && !stamp.isEmpty {
                try? data.write(to: folder.appendingPathComponent("Scales \(stamp).json"), options: .atomic)
                if let names = try? fm.contentsOfDirectory(atPath: folder.path) {
                    let dated = names.filter { $0.hasPrefix("Scales 2") && $0.hasSuffix(".json") }.sorted()
                    for name in dated.dropLast(14) { try? fm.removeItem(at: folder.appendingPathComponent(name)) }
                }
            }
            DispatchQueue.main.async { self.run("window.scalesSaved && window.scalesSaved({ ok: \(ok), where: '\(place)' })") }
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
        // TestFlight preview (1.82.0): a TestFlight copy can turn Plus on before the App Store approves it. The proof
        // is Apple's signed AppTransaction for this copy. Hidden unless the build's ScalesPlusPreview flag is on.
        if Bundle.main.object(forInfoDictionaryKey: "ScalesPlusPreview") as? Bool == true,
           let app = try? await AppTransaction.shared, case .verified(let at) = app,
           at.environment == .sandbox || at.environment == .xcode {
            state["preview"] = app.jwsRepresentation
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
