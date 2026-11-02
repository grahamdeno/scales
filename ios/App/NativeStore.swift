import UIKit
import WebKit

/// The copy of everything Scales saves, in a file the app owns (Application Support/Scales/store.json), so iOS
/// clearing the web view's storage can never lose a thought. NativeStore.js, run before the page, keeps it in step:
/// the page saves to localStorage as before, and each change comes here as a "store" message.
///
/// The file is {"rev": n, "data": {key: value}}. The revision only goes up. On each start the page is handed the
/// file, and whichever of the two is newer wins (see NativeStore.js).
final class NativeStore {
    private(set) var rev = 0
    private(set) var data: [String: String] = [:]
    private(set) var exists = false
    private let url: URL
    private let queue = DispatchQueue(label: "scales.store", qos: .utility)
    private var pending: DispatchWorkItem?

    init() {
        let fm = FileManager.default
        let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? fm.temporaryDirectory
        let dir = base.appendingPathComponent("Scales", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        url = dir.appendingPathComponent("store.json")
        if let raw = try? Data(contentsOf: url),
           let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
           let d = obj["data"] as? [String: String] {
            rev = obj["rev"] as? Int ?? 0
            data = d
            exists = true
        }
    }

    /// A "store" message from the page: a batch of changes, or (full) everything.
    func apply(_ body: [String: Any]) {
        let newRev = body["rev"] as? Int ?? 0
        // An older batch (a page from before a reload) never undoes a newer one.
        guard newRev > rev else { return }
        guard let set = body["set"] as? [String: String] else { return }
        let del = body["del"] as? [String] ?? []
        if body["full"] as? Bool == true {
            // A full copy with nothing in it never replaces a file that has something.
            if set.isEmpty && !data.isEmpty { return }
            data = set
        } else {
            for (k, v) in set { data[k] = v }
            for k in del { data.removeValue(forKey: k) }
        }
        rev = newRev
        exists = true
        // In the background there may be no second chance: write now.
        if UIApplication.shared.applicationState == .active { scheduleWrite() } else { pending?.cancel(); write(now: true) }
    }

    /// The keys that hold thoughts, in Scales 2 and in Scales 1.
    static let thoughtKeys = ["scales.next.thoughts.v1", "scales.thoughts.v1"]

    /// Brings in what the web version saved, adding only what is missing: thoughts the file doesn't have, and keys
    /// it doesn't have. Nothing already here is overwritten. Returns whether anything was added.
    @discardableResult
    func merge(_ legacy: [String: String]) -> Bool {
        var added = false
        for (k, v) in legacy where k.hasPrefix("scales") && k != "scales.native.rev" {
            guard let mine = data[k] else { data[k] = v; added = true; continue }
            guard Self.thoughtKeys.contains(k),
                  let a = try? JSONSerialization.jsonObject(with: Data(mine.utf8)) as? [String: Any],
                  let b = try? JSONSerialization.jsonObject(with: Data(v.utf8)) as? [String: Any] else { continue }
            var out = a
            for (id, t) in b where out[id] == nil { out[id] = t; added = true }
            if out.count != a.count, let json = try? JSONSerialization.data(withJSONObject: out), let str = String(data: json, encoding: .utf8) {
                data[k] = str
            }
        }
        if added || !exists {
            // Well above anything the page holds, so the merged file wins on the next start.
            rev += added ? 1000 : 1
            exists = true
            write(now: true)
        }
        return added
    }

    /// The script that hands the file to the page before it starts.
    func seedScript() -> String {
        guard exists, let json = try? JSONSerialization.data(withJSONObject: ["rev": rev, "data": data]),
              let s = String(data: json, encoding: .utf8) else { return "window.__scalesSeed = null;" }
        return "window.__scalesSeed = \(s);"
    }

    private func scheduleWrite() {
        pending?.cancel()
        let item = DispatchWorkItem { [weak self] in self?.write(now: false) }
        pending = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: item)
    }

    /// Writes now, on the way to the background, so a change is on disk before iOS can stop the app.
    func flush() {
        guard pending != nil else { return }
        pending?.cancel(); pending = nil
        write(now: true)
    }

    private func write(now: Bool) {
        pending = nil
        let snapshot: [String: Any] = ["rev": rev, "data": data]
        let target = url
        let work = {
            guard let json = try? JSONSerialization.data(withJSONObject: snapshot) else { return }
            try? json.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        if now {
            let app = UIApplication.shared
            let task = app.beginBackgroundTask(expirationHandler: nil)
            queue.sync(execute: work)
            if task != .invalid { app.endBackgroundTask(task) }
        } else {
            queue.async(execute: work)
        }
    }
}

/// Reads what the web version of Scales saved on this phone (localStorage at https://scales.tangomike.app), once, so the
/// bundled app starts with everything. Nothing is fetched: a blank page is given that address so
/// it can read its own storage. The old copy is left where it is.
final class LegacyReader: NSObject, WKNavigationDelegate {
    private var web: WKWebView?
    private var done: (([String: String]?) -> Void)?

    func read(in host: UIView, completion: @escaping ([String: String]?) -> Void) {
        done = completion
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        let w = WKWebView(frame: CGRect(x: 0, y: 0, width: 1, height: 1), configuration: config)
        w.isHidden = true
        w.navigationDelegate = self
        host.addSubview(w)
        web = w
        w.loadHTMLString("<!doctype html><title>Scales</title>", baseURL: URL(string: "https://scales.tangomike.app/app/")!)
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in self?.finish(nil) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = "(function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('scales')===0)o[k]=localStorage.getItem(k);}return JSON.stringify(o);})()"
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            guard let s = result as? String, let d = s.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: d) as? [String: String] else { self?.finish(nil); return }
            self?.finish(obj)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(nil) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(nil) }

    private func finish(_ result: [String: String]?) {
        guard let cb = done else { return }
        done = nil
        web?.removeFromSuperview()
        web = nil
        cb(result)
    }
}
