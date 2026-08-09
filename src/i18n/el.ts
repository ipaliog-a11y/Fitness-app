/**
 * Greek.
 *
 * Register: **informal singular** (διάλεξε, μπορείς), not the polite plural.
 * The app's voice is a coach talking to one runner — the English copy says
 * "you can switch any time", not "the user may switch" — and the polite plural
 * would make a training app sound like a utility bill. Every string here holds
 * that register; changing it later means revisiting all of them, so it is
 * worth disagreeing with now rather than at the end.
 *
 * Greek runs roughly 20–30% longer than English. Where a string sits in fixed
 * chrome — tab labels above all — the translation is deliberately shorter than
 * a faithful one would be.
 */

import type { Messages } from './en';

export const el: Messages = {
  // --- Shared ------------------------------------------------------------
  'common.done': 'Τέλος',
  'common.change': 'Αλλαγή',
  'common.cancel': 'Άκυρο',
  'common.save': 'Αποθήκευση',
  'common.delete': 'Διαγραφή',

  // --- Tab bar -----------------------------------------------------------
  // Five tabs share 390 px at 10 px type. "Προπονητής" is the tight one, so
  // the short arm is abbreviated harder than the English needs.
  'app.tab.run': 'Τρέξιμο',
  'app.tab.run.short': 'Τρέξ.',
  'app.tab.history': 'Ιστορικό',
  'app.tab.history.short': 'Ιστ.',
  'app.tab.coach': 'Προπονητής',
  'app.tab.coach.short': 'Προπ.',
  'app.tab.profile': 'Προφίλ',
  'app.tab.profile.short': 'Εσύ',
  'app.tab.settings': 'Ρυθμίσεις',
  'app.tab.settings.short': 'Ρυθμ.',

  // --- Settings: screen chrome -------------------------------------------
  'settings.title': 'Ρυθμίσεις',
  'settings.subtitle':
    'Γλώσσα, θέμα, μονάδες, συμπεριφορά τρεξίματος, διαδρομές και αντίγραφα ασφαλείας.',

  // --- Settings: language -------------------------------------------------
  'settings.language.title': 'Γλώσσα',
  'settings.language.hint':
    'Αλλάζει το περιβάλλον και τα κείμενα του προπονητή. Οι φωνητικές οδηγίες παραμένουν προς το παρόν στα αγγλικά.',
  'settings.language.modalHint':
    'Οι ημερομηνίες και οι αριθμοί ακολουθούν τη γλώσσα που διαλέγεις, όχι το τηλέφωνο.',
  'settings.language.groupLabel': 'Γλώσσα εφαρμογής',

  // --- Settings: theme ----------------------------------------------------
  'settings.theme.title': 'Θέμα',
  'settings.theme.hint':
    'Ίδια εφαρμογή, διαφορετική εμφάνιση. Διάλεξε ό,τι διαβάζεται πιο εύκολα έξω — μπορείς να αλλάξεις όποτε θες.',
  'settings.theme.modalHint':
    'Κάθε θέμα αλλάζει και την οθόνη του ζωντανού τρεξίματος, όχι μόνο τα χρώματα.',
  'settings.theme.groupLabel': 'Θέμα εφαρμογής',

  // --- Theme names --------------------------------------------------------
  // "Arcade" and "HUD" stay Latin: both are the words Greek speakers actually
  // use for these things, and translating them ("Οθόνη ενδείξεων") would be
  // less recognisable, not more.
  'theme.soft.label': 'Απαλό σμαραγδί',
  'theme.soft.blurb': 'Ήρεμες γκρι κάρτες, πράσινη πινελιά, θολωμένη μπάρα.',
  'theme.hud.label': 'Αθλητικό HUD',
  'theme.hud.blurb':
    'Σχεδόν μαύρο, φωσφοριζέ λαχανί, αριθμοί σταθερού πλάτους, συμπαγής μπάρα.',
  'theme.day.label': 'Φως ημέρας',
  'theme.day.blurb': 'Λευκό χαρτί, βαθύ πράσινο, συμπαγές περίγραμμα — για δυνατό ήλιο.',
  'theme.crimson.label': 'Βαθυκόκκινη θράκα',
  'theme.crimson.blurb':
    'Έντονο κόκκινο, κομμένες γωνίες, μπάρα στην άκρη — τολμηρό για νυχτερινό τρέξιμο.',
  'theme.sky.label': 'Ουρανογραμμή',
  'theme.sky.blurb': 'Γαλάζιο, πλήρεις κάψουλες, αιωρούμενη μπάρα — ήρεμο αεροπορικό ύφος.',
  'theme.retro.label': 'Νέον Arcade',
  'theme.retro.blurb':
    'Μοβ νέον σε απόλυτο μαύρο, μπάρα που λάμπει, ψηφία επτά τμημάτων — καθαρό 1985.',
};
