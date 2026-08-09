/**
 * Short branding + permission bootstrap screen shown before the main shell.
 */

import { APP_NAME, appBuildLabel, appVersionLabel } from '../core/appMeta';
import { createTranslator, detectLocale } from '../i18n';
import { parseLocale } from '../i18n';

interface Props {
  /** Current bootstrap line, e.g. "Location…" Falls back to a generic one. */
  status?: string;
}

/** The stored locale, or the device's, without waiting for the profile load. */
function readLocale() {
  try {
    const raw = localStorage.getItem('runlog:settings:v1');
    if (raw) return parseLocale((JSON.parse(raw) as { locale?: unknown }).locale);
  } catch {
    /* unreadable storage falls through to the device preference */
  }
  return detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
}

export function SplashScreen({ status }: Props) {
  /*
   * The splash renders above the I18nProvider — it is what the app shows
   * *while* the profile is still loading — so it resolves its own translator
   * from the stored locale, falling back to what the device asks for.
   */
  const t = createTranslator(readLocale());
  return (
    <div className="splash" role="status" aria-live="polite" aria-busy="true">
      <div className="splash-inner">
        <img
          className="splash-logo"
          src={`${import.meta.env.BASE_URL}icon-192.png`}
          alt=""
          width={96}
          height={96}
          decoding="async"
        />
        <h1 className="splash-title">{APP_NAME}</h1>
        <p className="splash-tagline">{t('splash.tagline')}</p>
        <p className="splash-meta">
          <span>{appVersionLabel()}</span>
          <span className="splash-meta-sep" aria-hidden>
            ·
          </span>
          <span>{appBuildLabel()}</span>
        </p>
        <p className="splash-status">{status ?? t('splash.status')}</p>
      </div>
    </div>
  );
}
