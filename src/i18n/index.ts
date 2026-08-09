/**
 * Translation: locale selection and message lookup.
 *
 * Deliberately hand-rolled rather than react-i18next. That library earns its
 * ~40 kB on server rendering, lazy namespaces and remote catalogue loading;
 * this app has none of those. What it does need is the guarantee below, which
 * the library cannot give: `Messages` is derived from the English catalogue,
 * so a locale missing a key is a **compile error**, not a string that silently
 * renders in English on someone's phone.
 *
 * Everything here is pure. `applyLocale` — the one part that touches the DOM —
 * lives next to `applyTheme` in core/settings.ts, because that is where this
 * codebase already keeps "push a preference at the document".
 */

import { en, type MessageKey, type Messages } from './en';
import { el } from './el';
import { isPlural, type Message } from './types';

export type { MessageKey, Messages };
export type { Message, PluralMessage } from './types';

/**
 * Shipping locales.
 *
 * Greek first. Dutch and Polish are planned, and the machinery already
 * accounts for them — Polish is why PluralMessage carries `few` and `many`,
 * which neither English nor Greek will ever fill.
 */
export type LocaleId = 'en' | 'el';

export const LOCALE_OPTIONS: Array<{
  id: LocaleId;
  /** The language's name in itself — what a speaker scans a list for. */
  endonym: string;
  /** Same name in English, as a subtitle, so a wrong pick is recoverable. */
  english: string;
}> = [
  { id: 'en', endonym: 'English', english: 'English' },
  { id: 'el', endonym: 'Ελληνικά', english: 'Greek' },
];

/**
 * BCP 47 tags for Intl.
 *
 * `en` resolves to en-GB, not en-US: the app's own copy is British (metres,
 * favour, kilometres), and a US tag would render 8/9/2026 for what the rest of
 * the interface calls 9 August.
 */
const BCP47: Record<LocaleId, string> = {
  en: 'en-GB',
  el: 'el-GR',
};

const CATALOGUES: Record<LocaleId, Messages> = { en, el };

export function localeTag(locale: LocaleId): string {
  return BCP47[locale];
}

/** Narrow a stored or user-supplied value to a locale we actually ship. */
export function parseLocale(value: unknown): LocaleId {
  if (value === 'el' || value === 'gr' || value === 'el-GR') return 'el';
  return 'en';
}

/**
 * First shipping locale the device asks for, else English.
 *
 * Takes the list rather than reading `navigator` so it stays pure and
 * testable. Matches on the primary subtag, so `el-CY` (Cypriot Greek) picks
 * Greek — the alternative is showing a Greek speaker an English app because
 * their region tag did not match.
 */
export function detectLocale(preferred: readonly string[]): LocaleId {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'el') return 'el';
    if (primary === 'en') return 'en';
  }
  return 'en';
}

export type Vars = Record<string, string | number>;

export type Translate = (key: MessageKey, vars?: Vars) => string;

/**
 * Pick the arm of a plural message that matches `count` in this locale.
 *
 * Exported for tests. The catalogue has no interpolating or plural key at the
 * moment the foundation lands, so testing these through `createTranslator`
 * would mean asserting on copy that is about to change — and leaving them
 * untested until then means the Polish few/many arms arrive unverified.
 */
export function pluralArm(message: Message, locale: LocaleId, vars: Vars | undefined): string {
  if (!isPlural(message)) return message;
  const count = vars?.count;
  if (typeof count !== 'number') return message.other;
  const category = new Intl.PluralRules(BCP47[locale]).select(count);
  // `category` is one of zero|one|two|few|many|other; only `other` is
  // guaranteed present, so every miss lands there rather than on undefined.
  return message[category] ?? message.other;
}

/**
 * Substitute `{name}` placeholders. Unknown names are left alone, visibly — a
 * literal `{name}` on screen is a bug report; a silently empty gap is not.
 *
 * Exported for tests, as above.
 */
export function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * A lookup function bound to one locale.
 *
 * The English fallback is belt-and-braces: the type system already rejects a
 * catalogue with a missing key, so reaching it means someone hand-edited a
 * catalogue past the compiler. Better a word in the wrong language than an
 * empty label on a button mid-run.
 */
export function createTranslator(locale: LocaleId): Translate {
  const primary = CATALOGUES[locale] ?? en;
  return (key, vars) => {
    const message = primary[key] ?? en[key];
    if (message === undefined) return key;
    return interpolate(pluralArm(message, locale, vars), vars);
  };
}
