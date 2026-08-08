/**
 * Short branding + permission bootstrap screen shown before the main shell.
 */

import { APP_NAME, appBuildLabel, appVersionLabel } from '../core/appMeta';

interface Props {
  /** Current bootstrap line, e.g. "Location…" */
  status?: string;
}

export function SplashScreen({ status = 'Getting ready…' }: Props) {
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
        <p className="splash-tagline">Local-first running</p>
        <p className="splash-meta">
          <span>{appVersionLabel()}</span>
          <span className="splash-meta-sep" aria-hidden>
            ·
          </span>
          <span>{appBuildLabel()}</span>
        </p>
        <p className="splash-status">{status}</p>
      </div>
    </div>
  );
}
