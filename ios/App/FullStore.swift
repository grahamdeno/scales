import Foundation
import StoreKit

/// Scales Full (2.36.0): one non-consumable purchase, $6.99, bought once and kept for good. Nothing renews.
/// The app is free to use. Argue with it, Tensions, Themes and Your week are Scales Full, and everyone has 14 days of
/// them from the day the app was first downloaded. That date is Apple's own record (AppTransaction), so deleting and
/// reinstalling does not restart it. This file only reports the facts ({ owned, since, price, found }); the page
/// (core.js, fullState) decides what they mean, and it never locks on a missing answer.
/// Nothing is collected: no account, no server, no purchase data leaves the phone beyond what Apple already holds.
@MainActor
final class FullStore {
    static let productID = "com.grahamdeno.scales.full"

    private let defaults = UserDefaults.standard
    private let ownedKey = "scales.full.owned"
    private let sinceKey = "scales.full.since"
    private var product: Product?
    private var listener: Task<Void, Never>?
    /// Called when ownership changes outside a button tap (a restored or family purchase arriving, a refund).
    var onChange: (() -> Void)?

    init() {
        // Purchases that finish later (Ask to Buy, an interrupted payment) arrive here.
        listener = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let tx) = result, tx.productID == Self.productID {
                    await tx.finish()
                    await self.refresh()
                    self.onChange?()
                }
            }
        }
    }

    deinit { listener?.cancel() }

    /// The page's view of things as a JSON string: { owned, since, price, found, note }.
    func snapshot(note: String = "") -> String {
        var d: [String: Any] = [
            "owned": defaults.bool(forKey: ownedKey),
            "since": defaults.string(forKey: sinceKey) ?? "",
            "found": product != nil,
            "price": product?.displayPrice ?? "",
        ]
        if !note.isEmpty { d["note"] = note }
        guard let data = try? JSONSerialization.data(withJSONObject: d), let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }

    /// Read what Apple holds: the product, whether it is owned, and the first-download date. Each part keeps its last
    /// known answer when Apple can't be reached, so being offline never changes what a person has.
    func refresh() async {
        if product == nil, let found = try? await Product.products(for: [Self.productID]).first { product = found }
        var owned = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == Self.productID, tx.revocationDate == nil { owned = true }
        }
        // Ownership is sticky: an empty or failed answer never takes it away. Only a refund (a revoked transaction) does.
        if owned {
            defaults.set(true, forKey: ownedKey)
        } else if let latest = await Transaction.latest(for: Self.productID), case .verified(let tx) = latest, tx.revocationDate != nil {
            defaults.set(false, forKey: ownedKey)
        }
        if let app = try? await AppTransaction.shared, case .verified(let t) = app {
            defaults.set(ISO8601DateFormatter().string(from: t.originalPurchaseDate), forKey: sinceKey)
        }
    }

    /// Buy it. Returns a short plain note for the page ("" when it went through or was cancelled).
    func buy() async -> String {
        if product == nil { await refresh() }
        guard let product else { return "Scales Full isn't available right now. Check your connection and try again." }
        do {
            switch try await product.purchase() {
            case .success(let result):
                if case .verified(let tx) = result {
                    await tx.finish()
                    defaults.set(true, forKey: ownedKey)
                    return ""
                }
                return "Apple couldn't verify the purchase. You haven't been charged for anything extra; try Restore."
            case .pending:
                return "The purchase is waiting for approval. Scales Full will turn on when it is approved."
            case .userCancelled:
                return ""
            @unknown default:
                return ""
            }
        } catch {
            return "The purchase didn't go through: \(error.localizedDescription)"
        }
    }

    /// Restore: ask the App Store to sync this Apple Account's purchases, then read them.
    func restore() async -> String {
        do { try await AppStore.sync() } catch { return "Couldn't reach the App Store to restore. Try again in a moment." }
        await refresh()
        return defaults.bool(forKey: ownedKey) ? "" : "No purchase of Scales Full was found on this Apple Account."
    }
}
