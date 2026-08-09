/**
 * Spoken cues via the Web Speech API.
 *
 * Failures are silent: a missing voices list or a locked autoplay policy must
 * never break the run. Call {@link warmSpeech} from a user gesture (Start) so
 * iOS unlocks speech for the rest of the session.
 */

/**
 * Cues are spoken in English whatever the interface language, by decision.
 *
 * That decision has to be restated on every utterance. An utterance with no
 * `lang` of its own inherits `<html lang>`, which the locale picker sets to
 * `el` — so the English cue lines were being handed to a Greek voice, which
 * sounds out the Latin letters with Greek phonemes. Setting it explicitly is
 * the whole fix; picking a voice below is the refinement.
 */
const CUE_LANG = 'en-US';

let warmed = false;
let listening = false;
let voice: SpeechSynthesisVoice | null = null;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
}

/** The parts of a voice the ranking reads — a structural subset of SpeechSynthesisVoice. */
export interface VoiceLike {
  lang: string;
  localService: boolean;
}

/** BCP-47 tags arrive as `en-US` or, from some Android engines, `en_US`. */
function tag(voice: VoiceLike): string {
  return voice.lang.replace('_', '-').toLowerCase();
}

/**
 * Rank an English voice. Higher wins.
 *
 * Offline dominates accent: a device voice still speaks in a tunnel or with
 * data switched off, which is where a run tends to be. Among offline voices
 * the variant is a tiebreak and nothing more.
 */
function score(voice: VoiceLike): number {
  const lang = tag(voice);
  return (voice.localService ? 4 : 0) + (lang === 'en-us' ? 2 : lang === 'en-gb' ? 1 : 0);
}

/** Best English voice in the list, or null if it holds none. */
export function pickEnglishVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null;
  for (const candidate of voices) {
    if (!/^en(-|$)/.test(tag(candidate))) continue;
    if (best === null || score(candidate) > score(best)) best = candidate;
  }
  return best;
}

function resolveVoice(): void {
  if (voice !== null || !speechSupported()) return;
  try {
    voice = pickEnglishVoice(window.speechSynthesis.getVoices());
  } catch {
    // Leave it null; speak() still sets the language.
  }
}

/** Unlock speech on iOS/Safari from a tap/click handler, and settle on a voice. */
export function warmSpeech(): void {
  if (!speechSupported()) return;

  /*
   * getVoices() is empty until the engine reports in, and on Chrome the first
   * call is what provokes the load. So ask now, and again when the list
   * arrives: some engines answer nothing before `voiceschanged`, others never
   * fire it. Neither path alone is reliable.
   */
  resolveVoice();
  if (!listening) {
    listening = true;
    try {
      window.speechSynthesis.addEventListener('voiceschanged', resolveVoice);
    } catch {
      // Older engines expose no event target; the lazy retry in speak() covers it.
    }
  }

  if (warmed) return;
  try {
    const utter = new SpeechSynthesisUtterance(' ');
    utter.lang = CUE_LANG;
    // Warm the voice the cues will actually use — warming a different one
    // leaves the first real cue to pay the engine's start-up cost anyway.
    if (voice !== null) utter.voice = voice;
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
    /*
     * Always state the language, even when the device turned out to have no
     * English voice: an engine asked for en-US it cannot supply still does
     * better than one left to inherit Greek from the document.
     */
    utter.lang = CUE_LANG;
    resolveVoice(); // The list may have arrived since the last cue.
    if (voice !== null) utter.voice = voice;
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
