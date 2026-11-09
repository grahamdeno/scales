import SwiftUI

/// Scales for iPhone. The app is the Scales web app (bundled inside from build 40) in a native shell that adds what a
/// web app can't do well on iPhone: haptics, the daily backup file, the app icon, and Apple Intelligence.
@main
struct ScalesApp: App {
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ScalesView()
                .ignoresSafeArea()
        }
        .onChange(of: phase) { _, now in
            if now == .active { Bridge.shared.becameActive() }
        }
    }
}

struct ScalesView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController { Bridge.shared.controller }
    func updateUIViewController(_ controller: WebViewController, context: Context) {}
}

/// The one web view, and the way in when Scales comes to the front.
@MainActor
final class Bridge {
    static let shared = Bridge()
    let controller = WebViewController()

    /// Tells the page each time Scales comes to the front.
    func becameActive() { controller.run("window.scalesActive && window.scalesActive()") }
}
