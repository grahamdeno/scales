import CoreHaptics
import UIKit

/// Haptics for Scales (1.84.1). The page asks for a style by name; this plays it.
/// A buzz confirms something the person did or rewards something they earned:
///   tick       a choice or an option (a light tap)
///   medium     press and hold opened Edit or Add
///   success    Reflect counted
///   thud       Lived: a weight set down
///   letgo      Let go: firm, then fading away
///   signature  the day's set done: a buzz that rises, then zips off. The page plays it once a day.
///   breathIn   2.38.0, box breathing: 4 s continuous, rising from soft to gentle
///   breathOut  2.38.0, box breathing: 4 s continuous, falling back to soft
///   breathStop 2.38.0: stops a breath at once (a touch, another screen, the app going to the background)
/// The standard styles use UIFeedbackGenerator; the two custom ones use Core Haptics and fall back to a
/// standard style on hardware without it.
final class Haptics {
    private let supports = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var engine: CHHapticEngine?
    /// The breath now playing, kept so breathStop can end it at once. Nil when none is playing.
    private var breathPlayer: CHHapticAdvancedPatternPlayer?

    init() {
        guard supports, let e = try? CHHapticEngine() else { return }
        e.isAutoShutdownEnabled = true
        e.resetHandler = { [weak e] in _ = try? e?.start() }
        engine = e
    }

    func play(_ style: String) {
        switch style {
        case "medium":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "success":
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning":
            // 2.29.0: Delete is armed; one more tap and the thought is gone.
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "thud":
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred(intensity: 1.0)
        case "signature":
            if !run(signature()) { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        case "letgo":
            if !run(letGo()) { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
        case "breathIn":
            // Box breathing: no Core Haptics, no haptic (a tap every 4 s would be the wrong signal).
            playBreath(breath(from: Breath.low, to: Breath.high))
        case "breathOut":
            playBreath(breath(from: Breath.high, to: Breath.low))
        case "breathStop":
            stopBreath()
        default:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    // MARK: Patterns

    private typealias Pattern = (events: [CHHapticEvent], curves: [CHHapticParameterCurve])

    /// Rises for 0.42 s, lands on one crisp tap, then a short bright zip that falls away.
    private func signature() -> Pattern {
        let rise = CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3),
        ], relativeTime: 0, duration: 0.42)
        let land = CHHapticEvent(eventType: .hapticTransient, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0),
        ], relativeTime: 0.44)
        let zip = CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0),
        ], relativeTime: 0.47, duration: 0.12)
        let riseCurve = CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
            .init(relativeTime: 0, value: 0.15), .init(relativeTime: 0.3, value: 0.6), .init(relativeTime: 0.42, value: 1.0),
            .init(relativeTime: 0.47, value: 1.0), .init(relativeTime: 0.59, value: 0.0),
        ], relativeTime: 0)
        let sharpCurve = CHHapticParameterCurve(parameterID: .hapticSharpnessControl, controlPoints: [
            .init(relativeTime: 0, value: -0.2), .init(relativeTime: 0.42, value: 0.4),
        ], relativeTime: 0)
        return ([rise, land, zip], [riseCurve, sharpCurve])
    }

    /// Starts firm and fades to nothing over 0.6 s.
    private func letGo() -> Pattern {
        let hold = CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.35),
        ], relativeTime: 0, duration: 0.6)
        let fade = CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
            .init(relativeTime: 0, value: 1.0), .init(relativeTime: 0.15, value: 0.7), .init(relativeTime: 0.6, value: 0.0),
        ], relativeTime: 0)
        return ([hold], [fade])
    }

    /// Every number for box breathing, in one place.
    private enum Breath {
        static let seconds = 4.0     // one in-breath or out-breath
        static let low = 0.15        // intensity at the soft end
        static let high = 0.6        // intensity at the gentle end
        static let sharpness = 0.15
    }

    /// One 4 s continuous event whose intensity moves from one end to the other. The event's own intensity is 1.0;
    /// the curve scales it (the same way signature and letGo do).
    private func breath(from a: Double, to b: Double) -> Pattern {
        let event = CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(Breath.sharpness)),
        ], relativeTime: 0, duration: Breath.seconds)
        let curve = CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
            .init(relativeTime: 0, value: Float(a)), .init(relativeTime: Breath.seconds, value: Float(b)),
        ], relativeTime: 0)
        return ([event], [curve])
    }

    /// Plays a breath, ending any breath still playing. Does nothing without Core Haptics.
    private func playBreath(_ p: Pattern) {
        stopBreath()
        guard supports, let engine else { return }
        do {
            try engine.start()
            let player = try engine.makeAdvancedPlayer(with: CHHapticPattern(events: p.events, parameterCurves: p.curves))
            breathPlayer = player
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            breathPlayer = nil
        }
    }

    private func stopBreath() {
        guard let player = breathPlayer else { return }
        breathPlayer = nil
        try? player.stop(atTime: CHHapticTimeImmediate)
    }

    private func run(_ p: Pattern) -> Bool {
        guard supports, let engine else { return false }
        do {
            try engine.start()
            let player = try engine.makePlayer(with: CHHapticPattern(events: p.events, parameterCurves: p.curves))
            try player.start(atTime: CHHapticTimeImmediate)
            return true
        } catch {
            return false
        }
    }
}
