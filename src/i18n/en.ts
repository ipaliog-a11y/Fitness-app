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

  // --- Heart rate zones ----------------------------------------------------
  'zone.recovery.name': 'Recovery',
  'zone.recovery.blurb': 'Very light. Warm-ups, cool-downs, and the easy end of easy.',
  'zone.easy.name': 'Easy',
  'zone.easy.blurb': 'Conversational. Where most of a sane training week lives.',
  'zone.aerobic.name': 'Aerobic',
  'zone.aerobic.blurb': 'Steady and purposeful. Talking gets clipped.',
  'zone.threshold.name': 'Threshold',
  'zone.threshold.blurb': 'Hard, sustainable for a while. This is where speed is bought.',
  'zone.maximum.name': 'Maximum',
  'zone.maximum.blurb': 'All out. Minutes, not hours.',

  // --- Recovery status -----------------------------------------------------
  'recovery.fresh.label': 'Fresh',
  'recovery.fresh.blurb':
    'Recent training is light. Build gradually — a quality session is fine if you feel good.',
  'recovery.balanced.label': 'Balanced',
  'recovery.balanced.blurb':
    'Load looks steady. Keep most running easy and save hard efforts for planned days.',
  'recovery.loaded.label': 'Loaded',
  'recovery.loaded.blurb':
    'The last week is heavier than your recent average. Favour easy pace and sleep.',
  'recovery.high.label': 'High load',
  'recovery.high.blurb':
    'Acute load is well above your recent base — a classic injury risk window. Ease volume and intensity.',
  'recovery.unknown.label': 'Not enough data',
  'recovery.unknown.blurb':
    'Log a few more runs and the coach can estimate recovery from your load pattern.',

  // --- Map basemaps --------------------------------------------------------
  'mapStyle.auto.label': 'Match theme',
  'mapStyle.auto.blurb': 'Light streets in Daylight; dark basemap in Soft and HUD.',
  'mapStyle.standard.label': 'Standard',
  'mapStyle.standard.blurb': 'Classic OpenStreetMap streets.',
  'mapStyle.dark.label': 'Dark',
  'mapStyle.dark.blurb': 'Carto dark basemap — easier on Soft / HUD.',
  'mapStyle.terrain.label': 'Terrain',
  'mapStyle.terrain.blurb': 'OpenTopoMap relief and contours for trails.',

  // --- Coach tips -----------------------------------------------------------
  // Numbers arrive already formatted for the unit system, so placeholders can
  // sit wherever the sentence needs them rather than where English put them.
  'coach.tip.run.title': 'The run',
  'coach.tip.run.body': '{distance} {unit} in {duration}, averaging {pace} {paceUnit}.',
  'coach.tip.longest.title': 'Longest run yet',
  'coach.tip.longest.body':
    'That is your longest run so far, beating {distance} {unit}. Give the next day or two some easy running.',
  'coach.tip.hard.title': 'That was a hard one',
  'coach.tip.hard.body':
    'Over half the run sat in zone 4 or 5 (average {bpm} bpm). Sessions like this are worth having, and worth following with an easy day.',
  'coach.tip.easy.title': 'Properly easy',
  'coach.tip.easy.body':
    '{percent}% of the run stayed in zones 1–2. Easy running is what most weekly volume should look like.',
  'coach.tip.noHr.title': 'No heart rate recorded',
  'coach.tip.noHr.body':
    'Connect a strap before the next run to get zone analysis alongside the pace.',
  'coach.tip.jump.title': 'Big jump in volume',
  'coach.tip.jump.body':
    'This week is already {thisWeek} {unit} against {lastWeek} {unit} last week. Increases of roughly 10% a week are the usual advice for staying uninjured.',
  'coach.tip.goalMet.title': 'Weekly goal met',
  'coach.tip.goalMet.body': '{distance} {unit} this week, past your {goal} {unit} goal.',
  'coach.tip.goal.title': 'Weekly goal',
  'coach.tip.goal.body': '{remaining} {unit} left to reach {goal} {unit} this week.',
  'coach.tip.empty.title': 'Nothing logged yet',
  'coach.tip.empty.body':
    'Start a run and it will show up here. Outdoors uses GPS; on a treadmill you can count steps or type the distance in.',
  'coach.tip.weekGoalMet.title': 'Goal met',
  'coach.tip.weekSoFar.title': 'This week so far',
  'coach.tip.weekProgress.body': '{distance} of {goal} {unit} — {percent}%.',
  'coach.tip.streak.title': {
    one: '{count}-day streak',
    other: '{count}-day streak',
  },
  'coach.tip.streak.body': 'Consistency does more for fitness than any single session.',
  'coach.tip.away.title': 'Been a while',
  'coach.tip.away.body': {
    one: '{days} day since the last run. Coming back a little shorter and slower than you left off tends to stick better.',
    other: '{days} days since the last run. Coming back a little shorter and slower than you left off tends to stick better.',
  },
  'coach.tip.average.title': 'Recent average',
  'coach.tip.average.body': {
    one: '{distance} {unit} a week over the last {weeks} week with running in it.',
    other: '{distance} {unit} a week over the last {weeks} weeks with running in them.',
  },
  'coach.tip.loadJump.title': 'Week-on-week load jump',
  'coach.tip.loadJump.body':
    'This week’s training load is already well above last week. Keep remaining sessions easy unless you planned a quality day.',
  'coach.tip.recovery.fresh': 'Recovery: Fresh',
  'coach.tip.recovery.balanced': 'Recovery: Balanced',
  'coach.tip.recovery.loaded': 'Recovery: Loaded',
  'coach.tip.recovery.high': 'Recovery: High load',
  'coach.tip.recovery.unknown': 'Recovery: Not enough data',

  // --- Workout phases -------------------------------------------------------
  // One fixed vocabulary shared by presets and custom intervals.

  'phase.cooldown': 'Cool-down',
  'phase.cooldownWalk': 'Cool-down walk',
  'phase.cruise': 'Cruise',
  'phase.easy': 'Easy',
  'phase.easyDown': 'Easy down',
  'phase.easyJog': 'Easy jog',
  'phase.easyRun': 'Easy run',
  'phase.easyWarmup': 'Easy warm-up',
  'phase.float': 'Float',
  'phase.hard': 'Hard',
  'phase.hard15s': 'Hard 15 s',
  'phase.hard1min': '1 min hard',
  'phase.hard2min': '2 min hard',
  'phase.hard30s': 'Hard 30 s',
  'phase.hard3min': '3 min hard',
  'phase.hard4min': '4 min hard',
  'phase.hard5min': '5 min hard',
  'phase.hard60s': 'Hard 60 s',
  'phase.hard90s': 'Hard 90 s',
  'phase.hillHard': 'Hill hard',
  'phase.m400': '400 m',
  'phase.m800': '800 m',
  'phase.recover': 'Recover',
  'phase.rest': 'Rest',
  'phase.run': 'Run',
  'phase.steady': 'Steady',
  'phase.stride': 'Stride',
  'phase.strong': 'Strong',
  'phase.surge': 'Surge',
  'phase.tempo': 'Tempo',
  'phase.tempo1': 'Tempo 1',
  'phase.tempo2': 'Tempo 2',
  'phase.walk': 'Walk',
  'phase.warmup': 'Warm-up',
  'phase.warmupWalk': 'Warm-up walk',
  'phase.work': 'Work',

  // Repeat counter, kept out of the label so the language can place it.
  'phase.repeat': '{label} ({index}/{total})',

  // --- Workout groups -------------------------------------------------------
  'workoutGroup.easy.name': 'Easy & base',
  'workoutGroup.easy.blurb': 'Conversational runs that build endurance without much fatigue.',
  'workoutGroup.walk-run.name': 'Walk / run',
  'workoutGroup.walk-run.blurb': 'Alternating run and walk — safe progression for new runners.',
  'workoutGroup.recovery.name': 'Recovery + strides',
  'workoutGroup.recovery.blurb': 'Easy volume with short pickups for form and feel.',
  'workoutGroup.mixed.name': 'Fartlek & mixed',
  'workoutGroup.mixed.blurb': 'Surges, ladders, and progressive efforts — quality without a track.',
  'workoutGroup.tempo.name': 'Tempo & threshold',
  'workoutGroup.tempo.blurb': 'Comfortably hard pace work for race-day strength.',
  'workoutGroup.speed.name': 'Speed, hills & VO₂',
  'workoutGroup.speed.blurb': 'Short hard efforts for power, speed, and max aerobic capacity.',

  // --- Workout presets ------------------------------------------------------
  'workout.easy-30.name': 'Easy 30',
  'workout.easy-30.blurb': 'Short easy run. Builds aerobic base and habit with low injury risk — most training should feel this easy.',
  'workout.easy-40.name': 'Easy 40',
  'workout.easy-40.blurb': 'Longer conversational run. More time on feet for endurance without hard stress — great base day.',
  'workout.long-easy-45.name': 'Long easy 45',
  'workout.long-easy-45.blurb': 'Mid-length long run. Improves durability and fat-burning comfort at easy pace — weekly cornerstone.',
  'workout.long-easy-60.name': 'Long easy 60',
  'workout.long-easy-60.blurb': 'Hour of easy volume. Builds deep aerobic endurance and mental ease with long duration — when 45 min feels short.',
  'workout.beginner-walk-run.name': 'Beginner walk/run',
  'workout.beginner-walk-run.blurb': '8 × 1 min run / 90 s walk. Classic starter — builds run time safely and lowers overload risk for new runners.',
  'workout.walk-run-2-1.name': 'Walk/run 2–1',
  'workout.walk-run-2-1.blurb': '6 × 2 min run / 1 min walk. Next step after short bouts — more continuous running with still-easy recoveries.',
  'workout.walk-run-3-1.name': 'Walk/run 3–1',
  'workout.walk-run-3-1.blurb': '5 × 3 min run / 1 min walk. Bridge toward continuous easy runs while keeping walk breaks for recovery.',
  'workout.recovery-strides.name': 'Recovery + strides',
  'workout.recovery-strides.blurb': 'Easy run plus 6 × 20 s form strides. Active recovery with a little speed and technique — ideal day after hard work.',
  'workout.progressive-35.name': 'Progressive 35',
  'workout.progressive-35.blurb': 'Easy → steady → strong finish. Teaches pace control and late-run toughness without full track intervals.',
  'workout.fartlek-20.name': 'Fartlek 20',
  'workout.fartlek-20.blurb': '10 × 1 min hard / 1 min easy. Playful speed + aerobic mix — fun quality without rigid track pacing.',
  'workout.ladder-fartlek.name': 'Ladder 5–4–3–2–1',
  'workout.ladder-fartlek.blurb': 'Descending hard blocks with equal easy recovery. Sustained effort then sharper finish — strong quality session.',
  'workout.mona-fartlek.name': 'Mona fartlek',
  'workout.mona-fartlek.blurb': '2×90 s, 4×60 s, 4×30 s, 4×15 s hard with equal float. Classic speed-play — neuromuscular snap plus aerobic stress.',
  'workout.pyramid.name': 'Pyramid 1–2–3–2–1',
  'workout.pyramid.blurb': 'Climb then descend hard minutes. Mixes short and mid efforts for variety and general fitness quality.',
  'workout.tempo-20.name': 'Tempo 20',
  'workout.tempo-20.blurb': '20 min comfortably hard. Classic threshold work — raises the pace you can hold and toughens race feel (10K–HM).',
  'workout.cruise-5x5.name': 'Cruise 5 × 5',
  'workout.cruise-5x5.blurb': '5 × 5 min threshold with 1 min easy. More total threshold time than one long tempo, with short resets between.',
  'workout.double-tempo.name': 'Double tempo 2 × 12',
  'workout.double-tempo.blurb': 'Two 12 min threshold blocks with a 3 min jog. Same goal as tempo, often easier to complete with a short break.',
  'workout.hill-8x45.name': 'Hills 8 × 45 s',
  'workout.hill-8x45.blurb': '8 × 45 s hard up (or flat drive) / 90 s easy. Strength, form, and power without pure track speed — great for hills or “power” days.',
  'workout.400-repeats.name': '6 × 400 m',
  'workout.400-repeats.blurb': 'Short fast reps with 90 s recoveries. Builds leg speed, economy, and anaerobic snap — classic 5K speed work.',
  'workout.800-repeats.name': '5 × 800 m',
  'workout.800-repeats.blurb': 'Classic mid-distance track intervals, 2 min recoveries. VO₂ and pace control around 3–5K effort — race prep staple.',
  'workout.vo2-3min.name': '5 × 3 min',
  'workout.vo2-3min.blurb': 'Hard 3 min with equal easy rest. Targets max aerobic capacity (VO₂) — high-quality fitness builder.',
  'workout.vo2-4x4.name': '4 × 4 min',
  'workout.vo2-4x4.blurb': 'Classic 4×4 VO₂ intervals with equal recovery. Strong stimulus for aerobic max — best when you already have a base.',

  'workout.custom.name': 'Custom {repeats}×',
  'workout.custom.blurb': '{repeats} × {work} min / {rest} min rest',
  'toast.workout': 'Workout: {name}',
  'workout.savedFallback': 'Saved custom workout',
  'workout.customFallback': 'Build your own work / rest repeats.',

  // --- Training plans -------------------------------------------------------
  'plan.start-to-run.name': 'Start to run',
  'plan.start-to-run.blurb': '8 weeks from walk-breaks to a steady 30-minute jog. Three days a week.',
  'plan.first-5k.name': 'First 5K',
  'plan.first-5k.blurb': '6 weeks aimed at covering 5 km without stress. Mix of easy days and one longer effort.',
  'plan.base-builder.name': 'Base builder',
  'plan.base-builder.blurb': '4 weeks of steady volume for runners who already run. Mostly easy, one longer day.',
  'plan.return-to-run.name': 'Return to run',
  'plan.return-to-run.blurb': '3 gentle weeks after time off. Short, easy, frequent enough to rebuild habit.',

  'planSession.easyWithWalkBreaks.title': 'Easy with walk breaks',
  'planSession.easy.title': 'Easy',
  'planSession.longerEasy.title': 'Longer easy',
  'planSession.longRun.title': 'Long run',
  'planSession.easyOrStrides.title': 'Easy or strides',
  'planSession.quality.title': 'Quality',

  'planSession.keepItConversationalShorterI.blurb': 'Keep it conversational. Shorter is fine.',
  'planSession.relaxedPaceAbout2030Minutes.blurb': 'Relaxed pace, about 20–30 minutes.',
  'planSession.keepItLightOptionalShortStri.blurb': 'Keep it light. Optional short strides at the end.',
  'planSession.oneFocusedSessionTempoOrShor.blurb': 'One focused session — tempo or short repeats if you feel good.',
  'planSession.sameIdeaKeepItShort.blurb': 'Same idea, keep it short.',
  'planSession.finishTheWeekWithoutChasingP.blurb': 'Finish the week without chasing pace.',

  'planSession.aboutMinEasy.blurb': 'About {minutes} min easy, walk as needed.',
  'planSession.buildPatience.blurb': 'Build patience — aim near {minutes} min total.',
  'planSession.buildToward5k.blurb': 'Build toward 5 km — about {km} km this week.',
  'planSession.kmEasy.blurb': '~{km} km easy.',
  'planSession.longAerobic.blurb': 'Long aerobic — about {km} km.',
  'planSession.minutesEasyWalk.blurb': '{minutes} minutes easy. Walk breaks allowed.',

  'planSession.gentlePickups.title': 'Gentle pickups',
  'planSession.finishQuicker.blurb':
    'Finish with a few minutes a touch quicker — still controlled.',
  'planSession.stayEasy.blurb': 'Stay easy. Consistency beats heroics.',
  'planKind.easy': 'Easy',
  'planKind.long': 'Long',
  'planKind.intervals': 'Intervals',
  'planKind.tempo': 'Tempo',
  'planKind.rest': 'Rest',
  'history.upcoming': 'upcoming',
  'history.done': 'done',

  'splash.tagline': 'Local-first running',
  'splash.status': 'Getting ready…',
  'record.1km': '1 km',
  'record.1mile': '1 mile',
  'record.5km': '5 km',
  'record.10km': '10 km',
  'record.half': 'Half marathon',
  'record.marathon': 'Marathon',

  'stats.title': 'Dashboard',
  'stats.subtitle': {
    one: '{runs} run · {distance} {unit} all time',
    other: '{runs} runs · {distance} {unit} all time',
  },
  'stats.streak': {
    one: '{count}-day streak',
    other: '{count}-day streak',
  },
  'stats.thisWeek': 'This week',
  'stats.time': 'Time',
  'stats.last12': 'Last 12 weeks',
  'stats.records': 'Personal records',
  'stats.goal': 'Goal',
  'stats.goalProgress': '{distance} of {goal} {unit} this week',
  'stats.recordsHint':
    'Records come from GPS runs — the fastest continuous stretch inside any run, so a quick 5 km buried in a longer one still counts.',

  // --- History --------------------------------------------------------------
  'history.title': 'History',
  'history.titleNamed': '{name}’s runs',
  'history.noRuns': 'No runs yet',
  'history.runsThisMonth': {
    one: '{count} run this month',
    other: '{count} runs this month',
  },
  'history.runsTotal': {
    one: '{count} run',
    other: '{count} runs',
  },
  'history.runsFiltered': '{count} of {total} runs',
  'history.viewLabel': 'History view',
  'history.filtersLabel': 'Quick filters',
  'history.filter.all': 'All',
  'history.range.all': 'All time',
  'history.range.week': 'This week',
  'history.range.month': 'This month',
  'history.range.year': 'This year',
  'history.extra.all': 'Anything',
  'history.extra.hr': 'Heart rate',
  'history.extra.workout': 'Workout',
  'history.extra.goal': 'Had a goal',
  'history.group.week': 'By week',
  'history.group.month': 'By month',
  'history.group.none': 'Flat list',
  'history.group.whenLabel': 'When',
  'history.group.withLabel': 'With',
  'run.outdoor': 'Outdoor',
  'run.treadmill': 'Treadmill',

  // --- Live run pods --------------------------------------------------------
  'run.pod.steps': 'steps',
  'run.pod.incline': 'incline',
  'run.pod.pace': 'pace',
  'run.pod.avg': 'avg',
  'run.pod.laps': 'laps',
  'run.pod.spm': 'spm',
  'run.pod.cadence': 'cadence',

  // --- Treadmill console ----------------------------------------------------
  'run.console.title': 'From the console',
  'run.console.noDistance': 'No distance',
  'run.console.noIncline': 'No incline',
  'run.console.inclineValue': '{percent}% incline',
  'run.console.distanceLabel': 'Distance ({unit}) — optional',
  'run.console.inclineLabel': 'Incline (%) — optional',
  'run.console.distanceHintPod': 'Console distance overrides the pod and calibrates it.',
  'run.console.distanceHintSteps': 'Overrides the step estimate and calibrates stride.',

  // --- Treadmill panel ------------------------------------------------------
  'run.panel.label': 'Treadmill view',
  'run.panel.effort': 'Effort',
  'run.panel.splits': 'Splits',
  'run.effort.warmingUp': 'Building the trace — give it a few seconds.',
  'run.effort.needSource':
    'Connect a heart rate strap, or let the step counter start, and effort will plot here.',
  'run.effort.bpm': 'bpm',
  'run.effort.chartLabel': 'Effort over time',
  'run.effort.range': 'Low {low} · high {high}',
  'run.splits.empty': 'Tap Lap and each split lands here.',
  'run.laps.title': 'Laps',
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
