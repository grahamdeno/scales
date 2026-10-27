import SwiftUI
import UserNotifications

/// Scales for iPhone. The app is the Scales web app (always the latest version, from
/// scales.tangomike.app/app) in a native shell that adds what a web app can't do well on
/// iPhone: reminders scheduled on the phone itself, and the Home Screen badge.
@main
struct ScalesApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
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

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    /// A reminder that arrives while Scales is open shows as a banner.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

/// The one web view, and the way in when Scales comes to the front.
@MainActor
final class Bridge {
    static let shared = Bridge()
    let controller = WebViewController()

    /// Scales recounts the badge and reschedules reminders whenever it comes to the front.
    func becameActive() { controller.run("window.scalesActive && window.scalesActive()") }
}
