import UIKit
import WebKit
import UserNotifications
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Shows Scales and answers what it asks of the phone: haptics, the daily backup file, the app icon, appearance,
/// Apple Intelligence, and downloads. (Build 39 took out Scales Plus, StoreKit and reminders.)
/// From build 40 the web app is inside the app (WebScheme.swift) and everything it saves is also kept in a file the
/// app owns (NativeStore.swift). Nothing is loaded from the internet.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
    private let home = WebScheme.home
    private let scheme = WebScheme()
    let store = NativeStore()
    private var content: WKUserContentController!
    private var web: WKWebView!
    private var ready = false          // Scales has started and can take scripts
    private let haptics = Haptics()
    private var queued: [String] = []  // scripts waiting for that
    // If the page can't start (it should never happen now that it is inside the app), a plain screen says so and
    // offers Try again.
    private var offline: UIView?

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        content = WKUserContentController()
        content.add(WeakHandler(self), name: "scales")
        config.userContentController = content
        config.setURLSchemeHandler(scheme, forURLScheme: WebScheme.scheme)

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        // 1.87.0: the page never zooms or slides under a stray touch. Scales scrolls inside its own views and
        // lifts its sheets above the keyboard itself, so the web view's own scrolling and zoom are off.
        web.scrollView.isScrollEnabled = false
        web.scrollView.minimumZoomScale = 1
        web.scrollView.maximumZoomScale = 1
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.scrollView.showsVerticalScrollIndicator = false
        web.scrollView.showsHorizontalScrollIndicator = false
        web.isOpaque = false
        // The ground Scales opens on, so nothing flashes while it loads: pistachio, or plum in Dark (2.6.0).
        web.backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0x3B / 255, green: 0x22 / 255, blue: 0x40 / 255, alpha: 1)
                : UIColor(red: 0xB9 / 255, green: 0xC9 / 255, blue: 0xA3 / 255, alpha: 1)
        }
        web.scrollView.backgroundColor = web.backgroundColor
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        view = web
        // 2.8.0: the Appearance chosen in Settings (Automatic, Light or Dark) holds from the first frame.
        applyLook(UserDefaults.standard.string(forKey: Self.lookKey) ?? "")
        NotificationCenter.default.addObserver(forName: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.sendA11y() }
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.store.flush() }
        if store.exists {
            start()
        } else {
            // First launch of the bundled app: bring over what the web version saved on this phone, then start.
            let reader = LegacyReader()
            legacy = reader
            reader.read(in: web) { [weak self] found in
                guard let self else { return }
                if let found { self.store.adopt(found) }
                self.legacy = nil
                self.start()
            }
        }
    }

    private var legacy: LegacyReader?

    /// The scripts that run before the page (rebuilt each time, so a reload gets the file as it is now), then the page.
    private func start() {
        content.removeAllUserScripts()
        // 1.83.2: the build number, shown in About, so a TestFlight copy says which build it is.
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        // 2.6.0: a TestFlight copy says so, so tests meant only for TestFlight can show there and nowhere else.
        let testflight = Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        content.addUserScript(WKUserScript(source: "window.scalesNative = { version: 1, platform: 'ios', build: '\(build)', testflight: \(testflight), look: true, bundled: true };",
                                           injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if let url = Bundle.main.url(forResource: "NativeStore", withExtension: "js"), let js = try? String(contentsOf: url, encoding: .utf8) {
            content.addUserScript(WKUserScript(source: store.seedScript() + "\n" + js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        ready = false
        web.load(URLRequest(url: home))
    }

    /// Run a script in Scales now, or once it has started.
    func run(_ script: String) {
        guard ready else { queued.append(script); return }
        web.evaluateJavaScript(script, completionHandler: nil)
    }

    // MARK: Messages from Scales

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only Scales itself, in the main frame, can ask the phone for anything.
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == WebScheme.scheme,
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "store":
            store.apply(body)
        case "ready":
            ready = true
            queued.forEach { web.evaluateJavaScript($0, completionHandler: nil) }
            queued.removeAll()
            sendIcon(); sendA11y()
        case "unschedule":
            clearReminders()
        case "badge":
            setBadge(body["count"] as? Int ?? 0)
        case "haptic":
            // 1.84.1: a named style (Haptics.swift); older pages send none and get a tick.
            haptics.play(body["style"] as? String ?? "tick")
        case "icon":
            // Automatic is the main icon, which follows the Home Screen's Light, Dark or Tinted style (Pistachio in Light,
            // Plum in Dark). Pistachio, Plum and Bone stay fixed (2.2.0). iOS says the icon changed itself.
            let pick = body["name"] as? String ?? ""
            let name: String? = Self.fixedIcons[pick]
            // 1.86.1: when iOS refuses, the page is told why instead of the choice quietly snapping back.
            guard UIApplication.shared.supportsAlternateIcons else { sendIcon(error: "this build has no alternate icons"); return }
            guard UIApplication.shared.alternateIconName != name else { sendIcon(); return }
            UIApplication.shared.setAlternateIconName(name) { err in
                DispatchQueue.main.async { self.sendIcon(error: err.map { "\(pick): \($0.localizedDescription)" }) }
            }
        case "look":
            // 2.8.0: Settings, Appearance. Light or Dark overrides the phone; Automatic follows it. The status bar,
            // keyboard and loading color follow too, and the choice is kept for the next launch.
            let look = body["value"] as? String ?? ""
            UserDefaults.standard.set(look, forKey: Self.lookKey)
            applyLook(look)
        case "save":
            save(json: body["json"] as? String ?? "", day: body["day"] as? String ?? "")
        case "aiStatus":
            sendAIStatus()
        case "ai":
            generate(id: body["id"] as? String ?? "", instructions: body["instructions"] as? String ?? "", prompt: body["prompt"] as? String ?? "")
        default:
            break
        }
    }

    /// Whether VoiceOver is on (1.81.0): the quiet fade never dims the screen for someone who isn't looking at it.
    private func sendA11y() {
        run("window.scalesA11y && window.scalesA11y({ voiceOver: \(UIAccessibility.isVoiceOverRunning) })")
    }

    // MARK: Apple Intelligence (2.6.0, a TestFlight test)
    // The page asks for one short piece of writing at a time and does all the counting itself. Apple's on-device
    // model writes it; nothing leaves the phone. On a phone without Apple Intelligence the page is told so.

    private func sendAIStatus() {
        var status = "unsupported"
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available: status = "available"
            case .unavailable(let reason): status = "unavailable: \(reason)"
            @unknown default: status = "unavailable"
            }
        }
        #endif
        runJSON("scalesAI", [status])
    }

    private func generate(id: String, instructions: String, prompt: String) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            Task { @MainActor in
                do {
                    let session = LanguageModelSession(instructions: instructions)
                    let answer = try await session.respond(to: prompt)
                    self.runJSON("scalesAIResult", [id, answer.content, ""])
                } catch {
                    self.runJSON("scalesAIResult", [id, "", "\(error)"])
                }
            }
            return
        }
        #endif
        runJSON("scalesAIResult", [id, "", "unsupported"])
    }

    /// Calls window.<name> with string arguments, passed safely as JSON, if the page has it.
    private func runJSON(_ name: String, _ args: [String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: args), let json = String(data: data, encoding: .utf8) else { return }
        run("window.\(name) && window.\(name).apply(null, \(json))")
    }

    /// The fixed icons, by the name the page uses. Automatic is the main icon and has no entry.
    private static let lookKey = "scales.look"
    private func applyLook(_ look: String) {
        let style: UIUserInterfaceStyle = look == "light" ? .light : look == "dark" ? .dark : .unspecified
        overrideUserInterfaceStyle = style
        view.window?.overrideUserInterfaceStyle = style
        setNeedsStatusBarAppearanceUpdate()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        view.window?.overrideUserInterfaceStyle = overrideUserInterfaceStyle
    }

    private static let fixedIcons = ["pistachio": "AppIcon-Pistachio", "plum": "AppIcon-Plum", "bone": "AppIcon-Bone"]

    /// Which icon is on the Home Screen, for the choice in Settings.
    private func sendIcon(error: String? = nil) {
        let n = UIApplication.shared.alternateIconName
        let on = Self.fixedIcons.first { $0.value == n }?.key ?? "auto"
        run("window.scalesIcon && window.scalesIcon('\(on)')")
        if let error, let data = try? JSONSerialization.data(withJSONObject: [error]), let json = String(data: data, encoding: .utf8) {
            run("window.scalesIconError && window.scalesIconError(\(json)[0])")
        }
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

    /// Clears any reminders and the badge an earlier version (Scales 1) left on this phone. Nothing is scheduled any more.
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

    // MARK: When the page can't start
    // The page is inside the app, so this should never show. If it does, a plain screen says so and offers Try again.

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hideOffline()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { loadError(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { loadError(error) }

    private func loadError(_ error: Error) {
        // A load that was cancelled on purpose (a link handed to Safari) or turned into a download is not a failure.
        let e = error as NSError
        if e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return }
        failed()
    }

    private func failed() {
        ready = false
        showOffline()
    }

    private func retry() { start() }

    @objc private func tryAgain() { retry() }

    private func showOffline() {
        if offline != nil { return }
        let ink = UIColor { $0.userInterfaceStyle == .dark
            ? UIColor(red: 0xF1 / 255, green: 0xE9 / 255, blue: 0xD8 / 255, alpha: 1)
            : UIColor(red: 0x2A / 255, green: 0x1E / 255, blue: 0x2E / 255, alpha: 1) }
        let panel = UIView(frame: view.bounds)
        panel.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        panel.backgroundColor = web.backgroundColor
        panel.layoutMargins = UIEdgeInsets(top: 0, left: 28, bottom: 0, right: 28)

        let title = UILabel()
        title.text = "Scales couldn't start."
        title.font = UIFontMetrics(forTextStyle: .title2).scaledFont(for: UIFont.systemFont(ofSize: 26, weight: .bold))
        title.adjustsFontForContentSizeCategory = true
        title.textColor = ink
        title.numberOfLines = 0

        let note = UILabel()
        note.text = "Try again. Your thoughts are safe on this phone."
        note.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: UIFont.systemFont(ofSize: 17))
        note.adjustsFontForContentSizeCategory = true
        note.textColor = ink
        note.numberOfLines = 0

        let button = UIButton(type: .system)
        button.setTitle("Try again", for: .normal)
        button.titleLabel?.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: UIFont.systemFont(ofSize: 17, weight: .semibold))
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.tintColor = ink
        button.contentHorizontalAlignment = .leading
        button.addTarget(self, action: #selector(tryAgain), for: .touchUpInside)
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true

        let stack = UIStackView(arrangedSubviews: [title, note, button])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: panel.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: panel.layoutMarginsGuide.trailingAnchor),
            stack.centerYAnchor.constraint(equalTo: panel.centerYAnchor)
        ])
        panel.accessibilityViewIsModal = true
        view.addSubview(panel)
        offline = panel
        UIAccessibility.post(notification: .screenChanged, argument: title)
    }

    private func hideOffline() {
        offline?.removeFromSuperview()
        offline = nil
    }

    // MARK: Links and downloads

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if action.shouldPerformDownload { return .download }
        let scheme = url.scheme ?? ""
        if ["blob", "data", "about"].contains(scheme) { return .allow }
        if url.scheme == WebScheme.scheme { return .allow }
        // Frames are allowed only from inside the app.
        if action.targetFrame?.isMainFrame == false { return .cancel }
        // Everything else (Wikiquote, the privacy policy, mail) opens in its own app or Safari.
        await UIApplication.shared.open(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        // A missing file would otherwise show as a blank page.
        if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
            failed()
            return .cancel
        }
        return response.canShowMIMEType ? .allow : .download
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
        store.flush()
        start()
    }
}

/// Keeps the message handler from holding the controller forever.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(c, didReceive: m) }
}
