import Foundation

/// The hand-off between the Share Sheet extension and the app (2.38.0, Scales 1.2): one file, inbox.json, in the App Group
/// container. The extension adds an entry when the person taps Keep; the app reads the entries when it opens and each time it
/// comes to the front, gives them to the page, and removes them only after the page says they are saved.
///
/// This one file is built into both targets, so the group, the file name and the entry's shape can't drift apart.
/// Nothing here touches the network, and nothing leaves the phone.
enum Inbox {
    /// The App Group (registered in the Apple Developer portal on 23 November 2026, team 7MHDTK68M2). In entitlements and in code
    /// the full string is written as here.
    static let group = "group.com.grahamdeno.scales"
    static let fileName = "inbox.json"
    /// The same limits as Write: 1500 characters of text, 200 for the "Who said it?" line.
    static let textMax = 1500
    static let sourceMax = 200

    /// One thing shared to Scales. `at` is when Keep was tapped (ISO 8601).
    struct Item: Codable, Equatable {
        let id: String
        let text: String
        let source: String
        let at: String
    }

    enum InboxError: Error { case noGroup }

    static func fileURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent(fileName)
    }

    /// Everything waiting, oldest first. An empty list if there is no file, no group, or the file can't be read.
    static func read() -> [Item] {
        guard let url = fileURL() else { return [] }
        var items: [Item] = []
        var coordinationError: NSError?
        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { u in
            items = load(u)
        }
        return items
    }

    /// Adds one entry. The file is read, changed and written back atomically, under a file coordinator, so the extension and
    /// the app can never leave half a file between them.
    static func append(_ item: Item) throws {
        try update { items in
            guard !items.contains(where: { $0.id == item.id }) else { return }
            items.append(Item(id: item.id, text: String(item.text.prefix(textMax)), source: String(item.source.prefix(sourceMax)), at: item.at))
        }
    }

    /// Removes the entries with these ids and no others (something shared while the page was working stays for next time).
    static func remove(ids: [String]) throws {
        let gone = Set(ids)
        try update { items in items.removeAll { gone.contains($0.id) } }
    }

    private static func load(_ url: URL) -> [Item] {
        guard let data = try? Data(contentsOf: url), let items = try? JSONDecoder().decode([Item].self, from: data) else { return [] }
        return items
    }

    private static func update(_ change: (inout [Item]) -> Void) throws {
        guard let url = fileURL() else { throw InboxError.noGroup }
        var coordinationError: NSError?
        var failure: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forMerging, error: &coordinationError) { u in
            var items = load(u)
            change(&items)
            do { try JSONEncoder().encode(items).write(to: u, options: .atomic) } catch { failure = error }
        }
        if let e = coordinationError { throw e }
        if let e = failure { throw e }
    }
}
