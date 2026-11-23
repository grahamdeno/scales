import UIKit
import UniformTypeIdentifiers

/// The Share Sheet extension (2.38.0, Scales 1.2): select text in any app, tap Share, then Scales. A small sheet in Scales'
/// plum and bone shows the text (editable), a Source line, and Keep and Cancel as words. Keep adds an entry to the inbox
/// in the App Group container (InboxFile.swift) and closes; the app adds it as a new thought the next time it opens.
/// Nothing is sent anywhere. A shared link with no text puts the link on the Source line and leaves the text empty;
/// Keep waits for words.
final class ShareViewController: UIViewController, UITextViewDelegate {
    // Scales' colors (index.html): plum ground, bone words, a softer plum for the Source line, pistachio for Keep.
    private let plum = UIColor(red: 0x3B / 255, green: 0x22 / 255, blue: 0x40 / 255, alpha: 1)
    private let field = UIColor(red: 0x23 / 255, green: 0x13 / 255, blue: 0x2A / 255, alpha: 1)
    private let bone = UIColor(red: 0xF1 / 255, green: 0xE9 / 255, blue: 0xD8 / 255, alpha: 1)
    private let muted = UIColor(red: 0xBB / 255, green: 0xA7 / 255, blue: 0xBE / 255, alpha: 1)
    private let pistachio = UIColor(red: 0xB9 / 255, green: 0xC9 / 255, blue: 0xA3 / 255, alpha: 1)

    private let textView = UITextView()
    private let sourceField = UITextField()
    private let keepButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = plum
        overrideUserInterfaceStyle = .dark
        build()
        loadShared()
        updateKeep()
    }

    // MARK: Layout

    private func build() {
        configure(cancelButton, title: "Cancel", color: bone, action: #selector(cancel))
        configure(keepButton, title: "Keep", color: pistachio, action: #selector(keep))
        keepButton.setTitleColor(muted.withAlphaComponent(0.6), for: .disabled)
        keepButton.titleLabel?.font = UIFont.preferredFont(forTextStyle: .headline)

        let title = UILabel()
        title.text = "Scales"
        title.textColor = muted
        title.font = UIFont.preferredFont(forTextStyle: .subheadline)
        title.adjustsFontForContentSizeCategory = true
        title.textAlignment = .center
        title.isAccessibilityElement = false

        let bar = UIStackView(arrangedSubviews: [cancelButton, title, keepButton])
        bar.axis = .horizontal
        bar.alignment = .center
        bar.distribution = .equalCentering

        textView.backgroundColor = field
        textView.textColor = bone
        textView.tintColor = pistachio
        textView.font = UIFont.preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)
        textView.layer.cornerRadius = 12
        textView.delegate = self
        textView.accessibilityLabel = "Thought"

        sourceField.backgroundColor = field
        sourceField.textColor = bone
        sourceField.tintColor = pistachio
        sourceField.font = UIFont.preferredFont(forTextStyle: .callout)
        sourceField.adjustsFontForContentSizeCategory = true
        sourceField.attributedPlaceholder = NSAttributedString(string: "Source (optional)", attributes: [.foregroundColor: muted])
        sourceField.autocorrectionType = .no
        sourceField.autocapitalizationType = .none
        sourceField.returnKeyType = .done
        sourceField.layer.cornerRadius = 12
        sourceField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 10, height: 44))
        sourceField.leftViewMode = .always
        sourceField.addTarget(self, action: #selector(done), for: .editingDidEndOnExit)
        sourceField.accessibilityLabel = "Source"
        // The Source line keeps its own height (and grows with Dynamic Type); the text takes the rest of the sheet.
        sourceField.setContentHuggingPriority(.required, for: .vertical)
        sourceField.setContentCompressionResistancePriority(.required, for: .vertical)
        textView.setContentHuggingPriority(.defaultLow, for: .vertical)

        for v in [bar, textView, sourceField] as [UIView] { v.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(v) }
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: guide.topAnchor, constant: 8),
            bar.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            bar.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            bar.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            textView.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 8),
            textView.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -16),
            sourceField.topAnchor.constraint(equalTo: textView.bottomAnchor, constant: 10),
            sourceField.leadingAnchor.constraint(equalTo: textView.leadingAnchor),
            sourceField.trailingAnchor.constraint(equalTo: textView.trailingAnchor),
            sourceField.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            sourceField.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -12),
            textView.heightAnchor.constraint(greaterThanOrEqualToConstant: 96),
        ])
    }

    /// A word, not an icon, at least 44 pt each way, and it grows with Dynamic Type.
    private func configure(_ b: UIButton, title: String, color: UIColor, action: Selector) {
        b.setTitle(title, for: .normal)
        b.setTitleColor(color, for: .normal)
        b.titleLabel?.font = UIFont.preferredFont(forTextStyle: .body)
        b.titleLabel?.adjustsFontForContentSizeCategory = true
        b.addTarget(self, action: action, for: .touchUpInside)
        b.translatesAutoresizingMaskIntoConstraints = false
        b.widthAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        b.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        b.accessibilityLabel = title
    }

    // MARK: What was shared

    /// Text becomes the text. A link becomes the Source, and the text starts empty (Keep waits for words). Text with a
    /// link (selected text from a web page) keeps both: the text, and the page as its source.
    private func loadShared() {
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let providers = items.flatMap { $0.attachments ?? [] }
        let lock = NSLock()
        var text = "", link = ""
        let group = DispatchGroup()
        for p in providers {
            if p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { v, _ in
                    if let u = v as? URL, u.scheme?.hasPrefix("http") == true { lock.lock(); if link.isEmpty { link = u.absoluteString }; lock.unlock() }
                    group.leave()
                }
            } else if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                p.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { v, _ in
                    if let s = v as? String { lock.lock(); if text.isEmpty { text = s }; lock.unlock() }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { [weak self] in
            var t = text.trimmingCharacters(in: .whitespacesAndNewlines), l = link
            // Some apps share a link as plain text: that is a link, not words.
            if l.isEmpty, !t.isEmpty, !t.contains(where: { $0.isWhitespace }), let u = URL(string: t), u.scheme?.hasPrefix("http") == true { l = t; t = "" }
            self?.show(text: t, source: l)
        }
    }

    private func show(text: String, source: String) {
        textView.text = String(text.prefix(Inbox.textMax))
        sourceField.text = String(source.prefix(Inbox.sourceMax))
        updateKeep()
        textView.becomeFirstResponder()
    }

    // MARK: Keep and Cancel

    /// Keep waits for words.
    private func updateKeep() {
        keepButton.isEnabled = !textView.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func textViewDidChange(_ textView: UITextView) { updateKeep() }

    /// The text limit is Write's.
    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        guard let current = textView.text, let r = Range(range, in: current) else { return true }
        return current.replacingCharacters(in: r, with: text).count <= Inbox.textMax
    }

    @objc private func done() { sourceField.resignFirstResponder() }

    @objc private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
    }

    @objc private func keep() {
        let text = textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let source = (sourceField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let item = Inbox.Item(id: UUID().uuidString, text: String(text.prefix(Inbox.textMax)), source: String(source.prefix(Inbox.sourceMax)),
                              at: ISO8601DateFormatter().string(from: Date()))
        do {
            try Inbox.append(item)
            extensionContext?.completeRequest(returningItems: nil)
        } catch {
            let alert = UIAlertController(title: "Not kept", message: "Scales couldn't hold this. Try again.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
        }
    }
}
