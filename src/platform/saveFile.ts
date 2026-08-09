/**
 * Getting a generated file out of the app and somewhere the athlete can find it.
 *
 * This used to be three copies of the same six lines, each building a blob URL,
 * clicking a detached anchor and revoking the URL on the very next statement.
 * On a phone that combination is close to the worst available: the file lands
 * in the download folder under a name nobody searched for, with no browser
 * chrome to show it happened, and every caller announced success whether or not
 * a single byte was written.
 */

export type SaveOutcome =
  /** Handed to the system share sheet — the athlete chose where it went. */
  | 'shared'
  /** Written to the browser's download folder. */
  | 'downloaded'
  /** The share sheet was dismissed. Not a failure, and not worth a toast. */
  | 'cancelled'
  | 'failed';

function canShareFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

/**
 * Download by clicking an anchor, done the careful way.
 *
 * Two details that look like ceremony and are not. The anchor goes into the
 * document, because engines other than Chrome ignore a click on a node that
 * was never in the tree. And the object URL is revoked on a timer rather than
 * on the next line: the click is dispatched asynchronously, so revoking
 * immediately can pull the blob out from under a download that had not started
 * yet — which loses the file with no error anywhere.
 */
function downloadViaAnchor(filename: string, blob: Blob): SaveOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    // Long enough for a slow device to have started reading it. The blob is
    // only held in memory until then.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/**
 * Offer a generated text file to the athlete, and report what actually
 * happened so the caller can stop guessing.
 *
 * The share sheet comes first where it exists, which on Android means "Save to
 * Files", "Drive", or straight into Strava, instead of a silent write to a
 * folder the Files app hides because it does not recognise the extension.
 */
export async function saveTextFile(
  filename: string,
  text: string,
  mime: string,
): Promise<SaveOutcome> {
  const blob = new Blob([text], { type: mime });

  let file: File | null = null;
  try {
    file = new File([blob], filename, { type: mime });
  } catch {
    // No File constructor: nothing to share, but the download still works.
  }

  if (file && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      // Dismissing the sheet is a decision, not a fault — do not then dump the
      // file into the download folder behind the athlete's back.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Anything else (no target app, permission trouble) is worth falling
      // back for rather than failing in front of them.
    }
  }

  return downloadViaAnchor(filename, blob);
}
