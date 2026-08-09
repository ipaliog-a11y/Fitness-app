/**
 * React binding for the translator.
 *
 * A context rather than a module-level singleton, because the locale is a
 * profile field: switching it has to re-render the tree, and a singleton would
 * hand back stale strings until something else happened to repaint.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createTranslator,
  localeTag,
  type LocaleId,
  type MessageKey,
  type Translate,
  type Vars,
} from './index';

interface I18nValue {
  t: Translate;
  locale: LocaleId;
  /** BCP 47 tag for Intl formatters, so screens do not re-derive it. */
  tag: string;
}

const FALLBACK: I18nValue = {
  t: createTranslator('en'),
  locale: 'en',
  tag: localeTag('en'),
};

const I18nContext = createContext<I18nValue>(FALLBACK);

export function I18nProvider({
  locale,
  children,
}: {
  locale: LocaleId;
  children: ReactNode;
}) {
  // Rebuilding the translator on every render would defeat any memo below it.
  const value = useMemo<I18nValue>(
    () => ({ t: createTranslator(locale), locale, tag: localeTag(locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The lookup function for the active locale. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}

/** Active locale plus its Intl tag, for date and number formatting. */
export function useLocale(): { locale: LocaleId; tag: string } {
  const { locale, tag } = useContext(I18nContext);
  return { locale, tag };
}

/**
 * Render a coach tip.
 *
 * Tips are the only content carrying keys *and* substitutions, and three
 * screens render them identically. Without this, each one repeats the same
 * `t(tip.title, tip.titleVars)` pairing — and the failure mode of forgetting
 * the vars is a sentence full of visible `{distance}` placeholders.
 */
export function useTipText(): (tip: {
  title: MessageKey;
  titleVars?: Vars;
  body: MessageKey;
  bodyVars?: Vars;
}) => { title: string; body: string } {
  const t = useT();
  return (tip) => ({
    title: t(tip.title, tip.titleVars),
    body: t(tip.body, tip.bodyVars),
  });
}
