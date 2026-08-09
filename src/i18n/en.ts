/**
 * English — the source catalogue.
 *
 * This file defines the key union every other locale must satisfy, so adding a
 * string here and nowhere else breaks the build until Greek (and later Dutch
 * and Polish) catch up. That is the point: a missing translation should stop a
 * release, not ship as an English word in a Greek sentence.
 *
 * Conventions:
 *  - Keys are dotted and grouped by where the string appears, not by meaning.
 *    `settings.theme.hint` is findable from the screen; `hint.theme` is not.
 *  - Flat, not nested. `keyof typeof en` then gives the union directly, with
 *    no path-type machinery to derive it.
 *  - `{name}` placeholders interpolate. Callers pass already-formatted numbers
 *    and dates, so the catalogue never has to know about units or Intl.
 *  - An object value is a plural. `count` selects the arm.
 */

import type { Message } from './types';

export const en = {
  // --- Shared ------------------------------------------------------------
  'common.done': 'Done',
  'common.change': 'Change',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',

  // --- Tab bar -----------------------------------------------------------
  // `.short` is the cramped variant used when six tabs share the dock.
  'app.tab.run': 'Run',
  'app.tab.run.short': 'Run',
  'app.tab.history': 'History',
  'app.tab.history.short': 'Hist',
  'app.tab.coach': 'Coach',
  'app.tab.coach.short': 'Coach',
  'app.tab.profile': 'Profile',
  'app.tab.profile.short': 'You',
  'app.tab.settings': 'Settings',
  'app.tab.settings.short': 'Set',

  // --- Settings: screen chrome -------------------------------------------
  'settings.title': 'Settings',
  'settings.subtitle': 'Language, theme, units, run behaviour, routes, and backups.',

  // --- Settings: language -------------------------------------------------
  'settings.language.title': 'Language',
  'settings.language.hint':
    'Changes the interface and coach text. Spoken run cues stay in English for now.',
  'settings.language.modalHint':
    'Dates and numbers follow the language you pick, not the phone.',
  'settings.language.groupLabel': 'App language',

  // --- Settings: theme ----------------------------------------------------
  'settings.theme.title': 'Theme',
  'settings.theme.hint':
    'Same app, different look. Pick whichever is easier to read outdoors — you can switch any time.',
  'settings.theme.modalHint': 'Each one restyles the live run screen too, not just the colours.',
  'settings.theme.groupLabel': 'App theme',

  // --- Theme names --------------------------------------------------------
  // Translatable rather than fixed product names: these describe a look, and a
  // Greek speaker gets nothing from "Soft Emerald" that "Απαλό σμαραγδί" does
  // not give them better.
  'theme.soft.label': 'Soft Emerald',
  'theme.soft.blurb': 'Calm slate cards, green accent, frosted tab bar.',
  'theme.hud.label': 'Athletic HUD',
  'theme.hud.blurb': 'Near-black, volt lime, mono numbers, solid dock.',
  'theme.day.label': 'Daylight',
  'theme.day.blurb': 'Paper white, deep green, solid chrome — built for direct sun.',
  'theme.crimson.label': 'Crimson Ember',
  'theme.crimson.blurb': 'Hot red, cut-gem corners, edge dock — bold night-run chrome.',
  'theme.sky.label': 'Skyline',
  'theme.sky.blurb': 'Sky blue, full pills, floating capsule tab — calm aviation feel.',
  'theme.retro.label': 'Arcade Neon',
  'theme.retro.blurb': 'Neon purple on pure black, glowing dock, segment digits — pure 1985.',
} satisfies Record<string, Message>;

/** Every key the app may ask for. Locales are checked against this. */
export type MessageKey = keyof typeof en;

/**
 * The contract a locale must satisfy.
 *
 * `Record<MessageKey, Message>` rather than `typeof en`, so a locale may use a
 * plural where English uses a bare string. Greek needs that for a couple of
 * counts English gets away with wording around, and Polish will need more.
 */
export type Messages = Record<MessageKey, Message>;
