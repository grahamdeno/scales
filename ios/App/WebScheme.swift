import Foundation
import WebKit

/// Serves the Scales web app from inside the app (the "web" folder, copied in at build time by
/// scripts/bundle-web.sh), at scales-app://local/. Nothing is loaded from the internet, so Scales opens with no
/// connection, and the app that runs is exactly the one in this build.
final class WebScheme: NSObject, WKURLSchemeHandler {
    static let scheme = "scales-app"
    static let home = URL(string: "scales-app://local/index.html?native=1")!
    private let root: URL? = Bundle.main.url(forResource: "web", withExtension: nil)

    private static let types = [
        "html": "text/html", "js": "text/javascript", "css": "text/css", "json": "application/json",
        "webmanifest": "application/manifest+json", "png": "image/png", "ico": "image/x-icon",
        "svg": "image/svg+xml", "woff2": "font/woff2", "txt": "text/plain"
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let root = self.root else { fail(task); return }
        var path = url.path
        if path.isEmpty || path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(String(path.drop(while: { $0 == "/" }))).standardizedFileURL
        // Only files inside the web folder.
        guard file.path.hasPrefix(root.standardizedFileURL.path + "/"), let body = try? Data(contentsOf: file) else { fail(task); return }
        let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let headers = ["Content-Type": type, "Content-Length": String(body.count), "Cache-Control": "no-store"]
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) else { fail(task); return }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func fail(_ task: WKURLSchemeTask) {
        task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
    }
}
