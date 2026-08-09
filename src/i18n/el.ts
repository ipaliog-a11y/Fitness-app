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

  // --- Achievements -------------------------------------------------------
  /*
   * Names re-invented, not mirrored. "Belt beast" is a joke about a treadmill
   * belt that dies in Greek word-for-word ("Θηρίο ιμάντα" means nothing), so
   * it becomes a joke about the treadmill instead. Where the English pun has
   * no Greek equivalent at all, the Greek goes for a phrase a runner would
   * actually say rather than a clever one nobody would.
   */
  'achievement.first-finish.title': 'Πρώτος τερματισμός',
  'achievement.first-finish.desc': 'Αποθήκευσε το πρώτο σου τρέξιμο. Κάθε σερί ξεκινά από ένα.',
  'achievement.k5.title': 'Λέσχη των 5K',
  'achievement.k5.desc': 'Ολοκλήρωσε ένα τρέξιμο τουλάχιστον 5 χλμ.',
  'achievement.k10.title': 'Λέσχη των 10K',
  'achievement.k10.desc': 'Ολοκλήρωσε ένα τρέξιμο τουλάχιστον 10 χλμ.',
  'achievement.half-marathon.title': 'Ημιμαραθώνιος',
  'achievement.half-marathon.desc': 'Τρέξε 21,1 χλμ σε μία συνεδρία — απόσταση ημιμαραθωνίου.',
  'achievement.k30.title': '30 χλμ μονοκοπανιά',
  'achievement.k30.desc': 'Κάλυψε 30 χλμ σε ένα τρέξιμο.',
  'achievement.marathon.title': 'Μαραθωνοδρόμος',
  'achievement.marathon.desc': 'Τρέξε 42,2 χλμ μονορούφι. Σεβασμός.',
  'achievement.lifetime-25.title': '25 χλμ συνολικά',
  'achievement.lifetime-25.desc': 'Μάζεψε 25 χλμ σε όλα σου τα αποθηκευμένα τρεξίματα.',
  'achievement.lifetime-50.title': '50 χλμ συνολικά',
  'achievement.lifetime-50.desc': 'Μάζεψε 50 χλμ συνολικού τρεξίματος.',
  'achievement.lifetime-100.title': 'Λέσχη των 100',
  'achievement.lifetime-100.desc': '100 χλμ συνολική απόσταση σε αυτή τη συσκευή.',
  'achievement.lifetime-250.title': '250 χλμ συνολικά',
  'achievement.lifetime-250.desc': '250 χλμ συνολικά χιλιόμετρα.',
  'achievement.lifetime-500.title': '500 χλμ συνολικά',
  'achievement.lifetime-500.desc': '500 χλμ συνολικά — σοβαρή βάση.',
  'achievement.lifetime-1000.title': '1 000 χλμ συνολικά',
  'achievement.lifetime-1000.desc': '1 000 χλμ καταγεγραμμένα στο RunLog.',
  'achievement.ten-runs.title': '10 τρεξίματα',
  'achievement.ten-runs.desc': 'Κατέγραψε 10 ολοκληρωμένα τρεξίματα.',
  'achievement.fifty-runs.title': 'Έγινε συνήθεια',
  'achievement.fifty-runs.desc': 'Κατέγραψε 50 ολοκληρωμένα τρεξίματα.',
  'achievement.easy-day.title': 'Ήρεμα ήρεμα',
  'achievement.easy-day.desc': 'Ολοκλήρωσε ένα τρέξιμο με χαλαρή ή περπάτημα/τρέξιμο δομή.',
  'achievement.fresh-legs.title': 'Φρέσκα πόδια',
  'achievement.fresh-legs.desc':
    'Άνοιξε τον Προπονητή με κατάσταση αποκατάστασης «Φρέσκος» (με κάποιο ιστορικό προπόνησης).',
  'achievement.balanced-load.title': 'Σε ισορροπία',
  'achievement.balanced-load.desc': 'Κατάσταση «Ισορροπημένος» — σταθερό φορτίο σε σχέση με τη βάση.',
  'achievement.recovery-strides.title': 'Ελαφρύ πάτημα',
  'achievement.recovery-strides.desc': 'Ολοκλήρωσε την προπόνηση «Αποκατάσταση + strides».',
  'achievement.tempo-tester.title': 'Δοκιμή σε tempo',
  'achievement.tempo-tester.desc': 'Ολοκλήρωσε μια προπόνηση tempo ή cruise threshold.',
  'achievement.interval-hero.title': 'Ήρωας του ιντερβάλ',
  'achievement.interval-hero.desc': 'Ολοκλήρωσε προπόνηση VO₂ ή στίβου (400άρια, 800άρια, 3′/4′).',
  'achievement.structured-run.title': 'Πάνω στο πλάνο',
  'achievement.structured-run.desc': 'Ολοκλήρωσε οποιαδήποτε δομημένη προπόνηση (όχι ελεύθερο τρέξιμο).',
  'achievement.goal-crusher.title': 'Στόχος στο τσεπάκι',
  'achievement.goal-crusher.desc': 'Πέτυχε στόχο απόστασης, χρόνου ή θερμίδων σε ένα τρέξιμο.',
  'achievement.streak-3.title': 'Τρεις στη σειρά',
  'achievement.streak-3.desc': 'Τρέξε 3 συνεχόμενες μέρες.',
  'achievement.streak-7.title': 'Πολεμιστής της εβδομάδας',
  'achievement.streak-7.desc': 'Τρέξε 7 συνεχόμενες μέρες.',
  'achievement.early-bird.title': 'Πρωινό ξύπνημα',
  'achievement.early-bird.desc': 'Ξεκίνα τρέξιμο πριν τις 7:00 τοπική ώρα.',
  'achievement.night-owl.title': 'Νυχτοπούλι',
  'achievement.night-owl.desc': 'Ξεκίνα τρέξιμο στις 20:00 ή αργότερα.',
  'achievement.named-runner.title': 'Με όνομα',
  'achievement.named-runner.desc': 'Όρισε όνομα εμφάνισης στο Προφίλ.',
  'achievement.full-identity.title': 'Πλήρης ταυτότητα',
  'achievement.full-identity.desc': 'Αποθήκευσε όνομα, ημερομηνία γέννησης και ύψος στο Προφίλ.',
  'achievement.coach-enrolled.title': 'Κλήση στον προπονητή',
  'achievement.coach-enrolled.desc': 'Ξεκίνα πλάνο προπόνησης στην καρτέλα Προπονητής.',
  'achievement.workout-factory.title': 'Εργοστάσιο προπονήσεων',
  'achievement.workout-factory.desc': 'Αποθήκευσε 5 δικές σου προπονήσεις στις «Προπονήσεις μου».',
  'achievement.first-custom.title': 'Γράφει συνταγές',
  'achievement.first-custom.desc': 'Αποθήκευσε την πρώτη σου δική σου προπόνηση.',
  'achievement.note-taker.title': 'Κρατάει σημειώσεις',
  'achievement.note-taker.desc': 'Πρόσθεσε προσωπική σημείωση σε ολοκληρωμένο τρέξιμο.',
  'achievement.route-saver.title': 'Χαρτογράφος φαντασμάτων',
  'achievement.route-saver.desc': 'Αποθήκευσε διαδρομή από ολοκληρωμένο τρέξιμο σε εξωτερικό χώρο.',
  'achievement.first-shoes.title': 'Δεμένα κορδόνια',
  'achievement.first-shoes.desc': 'Πρόσθεσε το πρώτο σου ζευγάρι παπούτσια.',
  'achievement.second-pair.title': 'Αρχίζει η ρόδα',
  'achievement.second-pair.desc': 'Πρόσθεσε δεύτερο ζευγάρι. Οι σόλες σου θα σε ευγνωμονούν.',
  'achievement.shoe-fleet.title': 'Στόλος παπουτσιών',
  'achievement.shoe-fleet.desc': 'Έχε τρία ή περισσότερα ζευγάρια στην παπουτσοθήκη.',
  'achievement.outdoor-soul.title': 'Ψυχή του δρόμου',
  'achievement.outdoor-soul.desc': 'Ολοκλήρωσε τρέξιμο με GPS σε εξωτερικό χώρο.',
  'achievement.belt-beast.title': 'Θηρίο του διαδρόμου',
  'achievement.belt-beast.desc': 'Ολοκλήρωσε τρέξιμο σε διάδρομο.',
  'achievement.both-worlds.title': 'Και στα δύο',
  'achievement.both-worlds.desc': 'Κατέγραψε τουλάχιστον ένα τρέξιμο έξω και ένα σε διάδρομο.',
  'achievement.hill-lover.title': 'Λάτρης των ανηφορών',
  'achievement.hill-lover.desc': 'Ολοκλήρωσε την προπόνηση «Ανηφόρες 8 × 45 δλ».',
  'achievement.hard-session.title': 'Το έδωσε όλο',
  'achievement.hard-session.desc': 'Ολοκλήρωσε σκληρή δομημένη προπόνηση (tempo, ταχύτητα, ανηφόρες, fartlek…).',

  'achievement.category.distance': 'Ορόσημα απόστασης',
  'achievement.category.lifetime': 'Συνολικά χιλιόμετρα',
  'achievement.category.recovery': 'Αποκατάσταση',
  'achievement.category.performance': 'Απόδοση',
  'achievement.category.app': 'Χρήση του RunLog',
  'achievement.category.fun': 'Διασκέδαση & εξοπλισμός',
  'achievement.unlockedOn': 'Ξεκλειδώθηκε {date}',
  'achievement.locked': 'Κλειδωμένο',
  'achievement.progress': '{unlocked} από {total} ξεκλειδωμένα',
  'toast.achievement.one': 'Επίτευγμα: {name}',
  'toast.achievement.many': {
    one: '{count} νέο επίτευγμα ξεκλειδώθηκε',
    other: '{count} νέα επιτεύγματα ξεκλειδώθηκαν',
  },
  'achievements.title': 'Επιτεύγματα',
  'achievements.subtitle': '{unlocked} από {total} ξεκλειδωμένα · κερδισμένα σε αυτή τη συσκευή',
};
