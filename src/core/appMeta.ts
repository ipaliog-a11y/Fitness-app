/**
 * App identity shown on the splash screen and in about-style UI.
 *
 * Version is injected at build time from package.json; build is a short stamp
 * so support can tell which APK/web bundle someone is on.
 */

declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILD__: string | undefined;

export const APP_NAME = 'RunLog';

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '0.1.0';

export const APP_BUILD: string =
  typeof __APP_BUILD__ !== 'undefined' && __APP_BUILD__
    ? __APP_BUILD__
    : 'dev';

export function appVersionLabel(): string {
  return `v${APP_VERSION}`;
}

export function appBuildLabel(): string {
  return `build ${APP_BUILD}`;
}
