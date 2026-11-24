import UIKit

/// Scales for iPhone. The app is the Scales web app (bundled inside from build 40) in a native shell that adds what a
/// web app can't do well on iPhone: haptics, the daily backup file, the app icon, and Apple Intelligence.
///
/// 2.37.0 (App Store 1.1): a UIKit app with one window scene, so the web view's controller is the window's root and can
/// set the status bar for each screen (light words on plum, dark words on pistachio). Under SwiftUI's WindowGroup the
/// hosting controller decided the status bar and ignored ours.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = Bridge.shared.controller
        window.makeKeyAndVisible()
        self.window = window
    }

    func sceneDidBecomeActive(_ scene: UIScene) { Bridge.shared.becameActive() }
}

/// The one web view, and the way in when Scales comes to the front.
@MainActor
final class Bridge {
    static let shared = Bridge()
    let controller = WebViewController()

    /// Tells the page each time Scales comes to the front.
    func becameActive() {
        controller.run("window.scalesActive && window.scalesActive()")
        controller.deliverInbox()   // 2.38.0: what was shared to Scales while it was closed or in the background
    }
}
