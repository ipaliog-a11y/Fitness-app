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
  // --- Achievements -------------------------------------------------------
  // Names are jokes, not labels. Locales re-invent rather than mirror them.

  'achievement.first-finish.title': 'First finish',
  'achievement.first-finish.desc': 'Save your first run. Every streak starts with one.',
  'achievement.k5.title': '5K club',
  'achievement.k5.desc': 'Complete a single run of at least 5 km.',
  'achievement.k10.title': '10K club',
  'achievement.k10.desc': 'Complete a single run of at least 10 km.',
  'achievement.half-marathon.title': 'Half marathon',
  'achievement.half-marathon.desc': 'Run 21.1 km in one session (half marathon distance).',
  'achievement.k30.title': '30 km single',
  'achievement.k30.desc': 'Cover 30 km in a single run.',
  'achievement.marathon.title': 'Marathoner',
  'achievement.marathon.desc': 'Run 42.2 km in one go. Respect.',
  'achievement.lifetime-25.title': '25 km lifetime',
  'achievement.lifetime-25.desc': 'Accumulate 25 km across all saved runs.',
  'achievement.lifetime-50.title': '50 km lifetime',
  'achievement.lifetime-50.desc': 'Accumulate 50 km of total running.',
  'achievement.lifetime-100.title': 'Century club',
  'achievement.lifetime-100.desc': '100 km total distance on this device.',
  'achievement.lifetime-250.title': '250 km lifetime',
  'achievement.lifetime-250.desc': '250 km lifetime mileage.',
  'achievement.lifetime-500.title': '500 km lifetime',
  'achievement.lifetime-500.desc': '500 km total — a serious base.',
  'achievement.lifetime-1000.title': '1 000 km lifetime',
  'achievement.lifetime-1000.desc': '1 000 km lifetime distance logged in RunLog.',
  'achievement.ten-runs.title': '10 runs logged',
  'achievement.ten-runs.desc': 'Log 10 finished runs.',
  'achievement.fifty-runs.title': 'Habit former',
  'achievement.fifty-runs.desc': 'Log 50 finished runs.',
  'achievement.easy-day.title': 'Easy does it',
  'achievement.easy-day.desc': 'Finish a run with an easy or walk/run structured workout.',
  'achievement.fresh-legs.title': 'Fresh legs',
  'achievement.fresh-legs.desc': 'Open Coach while recovery status is Fresh (with some training history).',
  'achievement.balanced-load.title': 'In balance',
  'achievement.balanced-load.desc': 'Recovery status Balanced — steady load vs base.',
  'achievement.recovery-strides.title': 'Stride light',
  'achievement.recovery-strides.desc': 'Complete the Recovery + strides workout.',
  'achievement.tempo-tester.title': 'Tempo tester',
  'achievement.tempo-tester.desc': 'Finish a tempo or cruise threshold workout.',
  'achievement.interval-hero.title': 'Interval hero',
  'achievement.interval-hero.desc': 'Complete a VO₂ or track-style speed session (400s, 800s, 3′/4′).',
  'achievement.structured-run.title': 'On the plan',
  'achievement.structured-run.desc': 'Finish any structured workout (not free run).',
  'achievement.goal-crusher.title': 'Goal crusher',
  'achievement.goal-crusher.desc': 'Hit a distance, time, or calorie goal on a run.',
  'achievement.streak-3.title': 'Three in a row',
  'achievement.streak-3.desc': 'Run on 3 consecutive days.',
  'achievement.streak-7.title': 'Week warrior',
  'achievement.streak-7.desc': 'Run on 7 consecutive days.',
  'achievement.early-bird.title': 'Early bird',
  'achievement.early-bird.desc': 'Start a run before 7:00 local time.',
  'achievement.night-owl.title': 'Night owl',
  'achievement.night-owl.desc': 'Start a run at 20:00 or later.',
  'achievement.named-runner.title': 'Named runner',
  'achievement.named-runner.desc': 'Set a display name in Profile.',
  'achievement.full-identity.title': 'Known quantity',
  'achievement.full-identity.desc': 'Save name, date of birth, and height in Profile.',
  'achievement.coach-enrolled.title': 'Coach call',
  'achievement.coach-enrolled.desc': 'Start a training plan on the Coach tab.',
  'achievement.workout-factory.title': 'Workout factory',
  'achievement.workout-factory.desc': 'Save 5 custom workouts under My Workouts.',
  'achievement.first-custom.title': 'Recipe writer',
  'achievement.first-custom.desc': 'Save your first custom workout.',
  'achievement.note-taker.title': 'Note taker',
  'achievement.note-taker.desc': 'Add a personal note to a finished run.',
  'achievement.route-saver.title': 'Ghost cartographer',
  'achievement.route-saver.desc': 'Save a route from a finished outdoor run.',
  'achievement.first-shoes.title': 'Laced up',
  'achievement.first-shoes.desc': 'Add your first pair of shoes.',
  'achievement.second-pair.title': 'Rotation begins',
  'achievement.second-pair.desc': 'Add a second pair of shoes. Your soles will thank you.',
  'achievement.shoe-fleet.title': 'Shoe fleet',
  'achievement.shoe-fleet.desc': 'Own three or more pairs in the shoe locker.',
  'achievement.outdoor-soul.title': 'Outdoor soul',
  'achievement.outdoor-soul.desc': 'Finish an outdoor GPS run.',
  'achievement.belt-beast.title': 'Belt beast',
  'achievement.belt-beast.desc': 'Finish a treadmill run.',
  'achievement.both-worlds.title': 'Both worlds',
  'achievement.both-worlds.desc': 'Log at least one outdoor and one treadmill run.',
  'achievement.hill-lover.title': 'Hill lover',
  'achievement.hill-lover.desc': 'Complete the Hills 8 × 45 s workout.',
  'achievement.hard-session.title': 'Went hard',
  'achievement.hard-session.desc': 'Finish any hard structured session (tempo, speed, hills, fartlek…).',

  'achievement.category.distance': 'Distance milestones',
  'achievement.category.lifetime': 'Lifetime mileage',
  'achievement.category.recovery': 'Recovery',
  'achievement.category.performance': 'Performance',
  'achievement.category.app': 'Using RunLog',
  'achievement.category.fun': 'Fun & gear',
  'achievement.unlockedOn': 'Unlocked {date}',
  'achievement.locked': 'Locked',
  'achievement.progress': '{unlocked} of {total} unlocked',
  'toast.achievement.one': 'Achievement: {name}',
  'toast.achievement.many': {
    one: '{count} new achievement unlocked',
    other: '{count} new achievements unlocked',
  },
  'achievements.title': 'Achievements',
  'achievements.subtitle': '{unlocked} of {total} unlocked · earned on this device',
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
