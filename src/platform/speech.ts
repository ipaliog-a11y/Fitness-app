/**
 * Spoken cues via the Web Speech API.
 *
 * Failures are silent: a missing voices list or a locked autoplay policy must
 * never break the run. Call {@link warmSpeech} from a user gesture (Start) so
 * iOS unlocks speech for the rest of the session.
 */

let warmed = false;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

/** Unlock speech on iOS/Safari from a tap/click handler. */
export function warmSpeech(): void {
  if (!speechSupported() || warmed) return;
  try {
    const utter = new SpeechSynthesisUtterance(' ');
    utter.volume = 0;
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
    window.speechSynthesis.cancel();
    warmed = true;
  } catch {
    // Ignore — cues will no-op if speech never unlocks.
  }
}

/**
 * Speak a short phrase. Cancels any in-flight utterance so rapid cues (lap +
 * kilometre) do not queue into a monologue.
 */
export function speak(text: string, options?: { interrupt?: boolean }): void {
  if (!speechSupported() || !text.trim()) return;
  try {
    if (options?.interrupt !== false) window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.05;
    utter.pitch = 1;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech is best-effort.
  }
}

/** Short vibration when the device allows it (goal met, auto-pause). */
export function pulse(pattern: number | number[] = 40): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration is optional.
  }
}
