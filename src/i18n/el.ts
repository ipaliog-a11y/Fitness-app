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

  // --- Heart rate zones ----------------------------------------------------
  'zone.recovery.name': 'Αποκατάσταση',
  'zone.recovery.blurb': 'Πολύ ελαφρύ. Ζέσταμα, χαλάρωμα και το πιο χαλαρό χαλαρό.',
  'zone.easy.name': 'Χαλαρό',
  'zone.easy.blurb': 'Μιλάς άνετα. Εδώ ζει το μεγαλύτερο μέρος μιας λογικής εβδομάδας.',
  'zone.aerobic.name': 'Αερόβιο',
  'zone.aerobic.blurb': 'Σταθερό και με σκοπό. Η κουβέντα αρχίζει να κόβεται.',
  'zone.threshold.name': 'Κατώφλι',
  'zone.threshold.blurb': 'Σκληρό αλλά διατηρήσιμο. Εδώ αγοράζεται η ταχύτητα.',
  'zone.maximum.name': 'Μέγιστο',
  'zone.maximum.blurb': 'Όλα έξω. Λεπτά, όχι ώρες.',

  // --- Recovery status -----------------------------------------------------
  // "Φορτίο" throughout for load, matching the Coach screen's own labels.
  'recovery.fresh.label': 'Φρέσκος',
  'recovery.fresh.blurb':
    'Η πρόσφατη προπόνηση είναι ελαφριά. Χτίσε σταδιακά — μια ποιοτική προπόνηση είναι μια χαρά αν νιώθεις καλά.',
  'recovery.balanced.label': 'Ισορροπημένος',
  'recovery.balanced.blurb':
    'Το φορτίο δείχνει σταθερό. Κράτα τα περισσότερα τρεξίματα χαλαρά και άφησε τις σκληρές προσπάθειες για τις προγραμματισμένες μέρες.',
  'recovery.loaded.label': 'Φορτωμένος',
  'recovery.loaded.blurb':
    'Η τελευταία εβδομάδα είναι πιο βαριά από τον πρόσφατο μέσο όρο σου. Προτίμησε χαλαρό ρυθμό και ύπνο.',
  'recovery.high.label': 'Υψηλό φορτίο',
  'recovery.high.blurb':
    'Το οξύ φορτίο είναι πολύ πάνω από την πρόσφατη βάση σου — κλασικό παράθυρο κινδύνου τραυματισμού. Χαμήλωσε όγκο και ένταση.',
  'recovery.unknown.label': 'Δεν φτάνουν τα δεδομένα',
  'recovery.unknown.blurb':
    'Κατέγραψε μερικά τρεξίματα ακόμη και ο προπονητής θα μπορεί να εκτιμήσει την αποκατάσταση από το μοτίβο του φορτίου σου.',

  // --- Map basemaps --------------------------------------------------------
  'mapStyle.auto.label': 'Ακολουθεί το θέμα',
  'mapStyle.auto.blurb': 'Φωτεινοί δρόμοι στο Φως ημέρας· σκούρος χάρτης στο Απαλό και το HUD.',
  'mapStyle.standard.label': 'Κανονικός',
  'mapStyle.standard.blurb': 'Κλασικοί δρόμοι OpenStreetMap.',
  'mapStyle.dark.label': 'Σκούρος',
  'mapStyle.dark.blurb': 'Σκούρος χάρτης Carto — πιο ήπιος για Απαλό / HUD.',
  'mapStyle.terrain.label': 'Ανάγλυφο',
  'mapStyle.terrain.blurb': 'Ανάγλυφο και ισοϋψείς OpenTopoMap για μονοπάτια.',

  // --- Coach tips -----------------------------------------------------------
  /*
   * Two places where Greek grammar forces a different shape from English:
   * coach.tip.average.body needs the count agreeing with «εβδομάδα/εβδομάδες»,
   * and coach.tip.away.body the same for «μέρα/μέρες». Both are plural
   * messages here even though the English got away with a bare string.
   */
  'coach.tip.run.title': 'Το τρέξιμο',
  'coach.tip.run.body': '{distance} {unit} σε {duration}, με μέσο όρο {pace} {paceUnit}.',
  'coach.tip.longest.title': 'Το μακρύτερο ως τώρα',
  'coach.tip.longest.body':
    'Είναι το μακρύτερο τρέξιμό σου μέχρι τώρα, ξεπερνώντας τα {distance} {unit}. Δώσε στην επόμενη μέρα ή δύο λίγο χαλαρό τρέξιμο.',
  'coach.tip.hard.title': 'Αυτό ήταν σκληρό',
  'coach.tip.hard.body':
    'Πάνω από το μισό τρέξιμο ήταν στη ζώνη 4 ή 5 (μέσος όρος {bpm} παλμοί). Τέτοιες προπονήσεις αξίζουν, και αξίζει να ακολουθούνται από μια χαλαρή μέρα.',
  'coach.tip.easy.title': 'Σωστά χαλαρό',
  'coach.tip.easy.body':
    'Το {percent}% του τρεξίματος έμεινε στις ζώνες 1–2. Έτσι πρέπει να δείχνει ο περισσότερος εβδομαδιαίος όγκος.',
  'coach.tip.noHr.title': 'Δεν καταγράφηκαν παλμοί',
  'coach.tip.noHr.body':
    'Σύνδεσε ζώνη στήθους πριν το επόμενο τρέξιμο για ανάλυση ζωνών μαζί με τον ρυθμό.',
  'coach.tip.jump.title': 'Μεγάλο άλμα σε όγκο',
  'coach.tip.jump.body':
    'Αυτή η εβδομάδα είναι ήδη {thisWeek} {unit} έναντι {lastWeek} {unit} την προηγούμενη. Αυξήσεις γύρω στο 10% την εβδομάδα είναι η συνήθης σύσταση για να μένεις χωρίς τραυματισμό.',
  'coach.tip.goalMet.title': 'Ο εβδομαδιαίος στόχος πιάστηκε',
  'coach.tip.goalMet.body': '{distance} {unit} αυτή την εβδομάδα, πάνω από τον στόχο των {goal} {unit}.',
  'coach.tip.goal.title': 'Εβδομαδιαίος στόχος',
  'coach.tip.goal.body': 'Μένουν {remaining} {unit} για να φτάσεις τα {goal} {unit} αυτή την εβδομάδα.',
  'coach.tip.empty.title': 'Τίποτα καταγεγραμμένο ακόμη',
  'coach.tip.empty.body':
    'Ξεκίνα ένα τρέξιμο και θα εμφανιστεί εδώ. Έξω χρησιμοποιείται GPS· στον διάδρομο μπορείς να μετράς βήματα ή να γράφεις την απόσταση.',
  'coach.tip.weekGoalMet.title': 'Ο στόχος πιάστηκε',
  'coach.tip.weekSoFar.title': 'Αυτή η εβδομάδα ως τώρα',
  'coach.tip.weekProgress.body': '{distance} από {goal} {unit} — {percent}%.',
  'coach.tip.streak.title': {
    one: 'Σερί {count} ημέρας',
    other: 'Σερί {count} ημερών',
  },
  'coach.tip.streak.body': 'Η συνέπεια κάνει περισσότερα για τη φυσική κατάσταση από οποιαδήποτε μεμονωμένη προπόνηση.',
  'coach.tip.away.title': 'Καιρό είχαμε',
  'coach.tip.away.body': {
    one: '{days} μέρα από το τελευταίο τρέξιμο. Η επιστροφή λίγο πιο σύντομη και πιο αργή απ’ ό,τι σταμάτησες συνήθως κρατάει καλύτερα.',
    other: '{days} μέρες από το τελευταίο τρέξιμο. Η επιστροφή λίγο πιο σύντομη και πιο αργή απ’ ό,τι σταμάτησες συνήθως κρατάει καλύτερα.',
  },
  'coach.tip.average.title': 'Πρόσφατος μέσος όρος',
  'coach.tip.average.body': {
    one: '{distance} {unit} την εβδομάδα, στην τελευταία {weeks} εβδομάδα με τρέξιμο μέσα.',
    other: '{distance} {unit} την εβδομάδα, στις τελευταίες {weeks} εβδομάδες με τρέξιμο μέσα.',
  },
  'coach.tip.loadJump.title': 'Άλμα φορτίου από εβδομάδα σε εβδομάδα',
  'coach.tip.loadJump.body':
    'Το φορτίο προπόνησης αυτής της εβδομάδας είναι ήδη πολύ πάνω από την προηγούμενη. Κράτα τις υπόλοιπες προπονήσεις χαλαρές, εκτός αν είχες προγραμματίσει ποιοτική μέρα.',
  'coach.tip.recovery.fresh': 'Αποκατάσταση: Φρέσκος',
  'coach.tip.recovery.balanced': 'Αποκατάσταση: Ισορροπημένος',
  'coach.tip.recovery.loaded': 'Αποκατάσταση: Φορτωμένος',
  'coach.tip.recovery.high': 'Αποκατάσταση: Υψηλό φορτίο',
  'coach.tip.recovery.unknown': 'Αποκατάσταση: Δεν φτάνουν τα δεδομένα',

  // --- Workout phases -------------------------------------------------------
  /*
   * The agreed glossary in action. Greek runners say "tempo", "fartlek",
   * "strides" and "cruise" in English — translating them reads like a textbook
   * nobody uses — while warm-up, cool-down, recovery and hard have perfectly
   * ordinary Greek words that everyone does use. Kept short: these sit in
   * interval strips and phase chips with very little room.
   */
  'phase.cooldown': 'Χαλάρωμα',
  'phase.cooldownWalk': 'Χαλάρωμα με περπάτημα',
  'phase.cruise': 'Cruise',
  'phase.easy': 'Χαλαρό',
  'phase.easyDown': 'Χαλαρό κατέβασμα',
  'phase.easyJog': 'Χαλαρό τζόγκινγκ',
  'phase.easyRun': 'Χαλαρό τρέξιμο',
  'phase.easyWarmup': 'Χαλαρό ζέσταμα',
  'phase.float': 'Float',
  'phase.hard': 'Δυνατά',
  'phase.hard15s': 'Δυνατά 15 δλ',
  'phase.hard1min': '1 λεπτό δυνατά',
  'phase.hard2min': '2 λεπτά δυνατά',
  'phase.hard30s': 'Δυνατά 30 δλ',
  'phase.hard3min': '3 λεπτά δυνατά',
  'phase.hard4min': '4 λεπτά δυνατά',
  'phase.hard5min': '5 λεπτά δυνατά',
  'phase.hard60s': 'Δυνατά 60 δλ',
  'phase.hard90s': 'Δυνατά 90 δλ',
  'phase.hillHard': 'Ανηφόρα δυνατά',
  'phase.m400': '400 μ',
  'phase.m800': '800 μ',
  'phase.recover': 'Αποκατάσταση',
  'phase.rest': 'Ξεκούραση',
  'phase.run': 'Τρέξιμο',
  'phase.steady': 'Σταθερό',
  'phase.strong': 'Δυνατό',
  'phase.stride': 'Stride',
  'phase.surge': 'Επιτάχυνση',
  'phase.tempo': 'Tempo',
  'phase.tempo1': 'Tempo 1',
  'phase.tempo2': 'Tempo 2',
  'phase.walk': 'Περπάτημα',
  'phase.warmup': 'Ζέσταμα',
  'phase.warmupWalk': 'Ζέσταμα με περπάτημα',
  'phase.work': 'Προσπάθεια',

  'phase.repeat': '{label} ({index}/{total})',

  // --- Workout groups -------------------------------------------------------
  'workoutGroup.easy.name': 'Χαλαρά & βάση',
  'workoutGroup.easy.blurb': 'Τρεξίματα κουβέντας που χτίζουν αντοχή χωρίς πολλή κόπωση.',
  'workoutGroup.walk-run.name': 'Περπάτημα / τρέξιμο',
  'workoutGroup.walk-run.blurb': 'Εναλλαγή τρεξίματος και περπατήματος — ασφαλής πρόοδος για αρχάριους.',
  'workoutGroup.recovery.name': 'Αποκατάσταση + strides',
  'workoutGroup.recovery.blurb': 'Χαλαρός όγκος με σύντομες επιταχύνσεις για τεχνική και αίσθηση.',
  'workoutGroup.mixed.name': 'Fartlek & μικτά',
  'workoutGroup.mixed.blurb': 'Επιταχύνσεις, σκάλες και προοδευτικές προσπάθειες — ποιότητα χωρίς στίβο.',
  'workoutGroup.tempo.name': 'Tempo & κατώφλι',
  'workoutGroup.tempo.blurb': 'Άνετα σκληρός ρυθμός για δύναμη στον αγώνα.',
  'workoutGroup.speed.name': 'Ταχύτητα, ανηφόρες & VO₂',
  'workoutGroup.speed.blurb': 'Σύντομες δυνατές προσπάθειες για ισχύ, ταχύτητα και μέγιστη αερόβια ικανότητα.',

  // --- Workout presets ------------------------------------------------------
  'workout.easy-30.name': 'Χαλαρό 30',
  'workout.easy-30.blurb':
    'Σύντομο χαλαρό τρέξιμο. Χτίζει αερόβια βάση και συνήθεια με χαμηλό ρίσκο τραυματισμού — έτσι χαλαρή πρέπει να είναι η περισσότερη προπόνηση.',
  'workout.easy-40.name': 'Χαλαρό 40',
  'workout.easy-40.blurb':
    'Πιο μεγάλο τρέξιμο κουβέντας. Περισσότερος χρόνος στα πόδια για αντοχή χωρίς σκληρή καταπόνηση — εξαιρετική μέρα βάσης.',
  'workout.long-easy-45.name': 'Μεγάλο χαλαρό 45',
  'workout.long-easy-45.blurb':
    'Μεσαίο μεγάλο τρέξιμο. Βελτιώνει την αντοχή και την άνεση σε χαλαρό ρυθμό — ο ακρογωνιαίος λίθος της εβδομάδας.',
  'workout.long-easy-60.name': 'Μεγάλο χαλαρό 60',
  'workout.long-easy-60.blurb':
    'Μία ώρα χαλαρού όγκου. Χτίζει βαθιά αερόβια αντοχή και ψυχική άνεση με μεγάλη διάρκεια — όταν τα 45 λεπτά μοιάζουν λίγα.',
  'workout.beginner-walk-run.name': 'Περπάτημα/τρέξιμο αρχαρίων',
  'workout.beginner-walk-run.blurb':
    '8 × 1 λεπτό τρέξιμο / 90 δλ περπάτημα. Κλασικό ξεκίνημα — χτίζει χρόνο τρεξίματος με ασφάλεια και μειώνει το ρίσκο υπερφόρτωσης.',
  'workout.walk-run-2-1.name': 'Περπάτημα/τρέξιμο 2–1',
  'workout.walk-run-2-1.blurb':
    '6 × 2 λεπτά τρέξιμο / 1 λεπτό περπάτημα. Το επόμενο βήμα μετά τις σύντομες δόσεις — πιο συνεχόμενο τρέξιμο με ακόμη χαλαρές αποκαταστάσεις.',
  'workout.walk-run-3-1.name': 'Περπάτημα/τρέξιμο 3–1',
  'workout.walk-run-3-1.blurb':
    '5 × 3 λεπτά τρέξιμο / 1 λεπτό περπάτημα. Γέφυρα προς το συνεχόμενο χαλαρό τρέξιμο, κρατώντας διαλείμματα περπατήματος για αποκατάσταση.',
  'workout.recovery-strides.name': 'Αποκατάσταση + strides',
  'workout.recovery-strides.blurb':
    'Χαλαρό τρέξιμο συν 6 × 20 δλ strides τεχνικής. Ενεργητική αποκατάσταση με λίγη ταχύτητα και τεχνική — ιδανικό για τη μέρα μετά από σκληρή δουλειά.',
  'workout.progressive-35.name': 'Προοδευτικό 35',
  'workout.progressive-35.blurb':
    'Χαλαρό → σταθερό → δυνατό φινάλε. Μαθαίνει έλεγχο ρυθμού και αντοχή στο τέλος, χωρίς κανονικά ιντερβάλ στίβου.',
  'workout.fartlek-20.name': 'Fartlek 20',
  'workout.fartlek-20.blurb':
    '10 × 1 λεπτό δυνατά / 1 λεπτό χαλαρά. Παιχνιδιάρικο μείγμα ταχύτητας και αερόβιου — ποιότητα με πλάκα, χωρίς αυστηρούς ρυθμούς στίβου.',
  'workout.ladder-fartlek.name': 'Σκάλα 5–4–3–2–1',
  'workout.ladder-fartlek.blurb':
    'Φθίνοντα δυνατά μπλοκ με ίση χαλαρή αποκατάσταση. Παρατεταμένη προσπάθεια και μετά πιο κοφτό φινάλε — δυνατή ποιοτική προπόνηση.',
  'workout.mona-fartlek.name': 'Mona fartlek',
  'workout.mona-fartlek.blurb':
    '2×90 δλ, 4×60 δλ, 4×30 δλ, 4×15 δλ δυνατά με ίσο float. Κλασικό speed-play — νευρομυϊκή σπίθα μαζί με αερόβια καταπόνηση.',
  'workout.pyramid.name': 'Πυραμίδα 1–2–3–2–1',
  'workout.pyramid.blurb':
    'Ανέβασμα και μετά κατέβασμα σε δυνατά λεπτά. Μπλέκει σύντομες και μεσαίες προσπάθειες για ποικιλία και γενική ποιότητα.',
  'workout.tempo-20.name': 'Tempo 20',
  'workout.tempo-20.blurb':
    '20 λεπτά άνετα σκληρά. Κλασική δουλειά κατωφλιού — ανεβάζει τον ρυθμό που αντέχεις και σκληραγωγεί την αίσθηση αγώνα (10Κ–ΗΜ).',
  'workout.cruise-5x5.name': 'Cruise 5 × 5',
  'workout.cruise-5x5.blurb':
    '5 × 5 λεπτά κατώφλι με 1 λεπτό χαλαρά. Περισσότερος συνολικός χρόνος στο κατώφλι από ένα μεγάλο tempo, με σύντομα διαλείμματα.',
  'workout.double-tempo.name': 'Διπλό tempo 2 × 12',
  'workout.double-tempo.blurb':
    'Δύο μπλοκ κατωφλιού 12 λεπτών με 3 λεπτά τζόγκινγκ. Ίδιος στόχος με το tempo, συχνά πιο εύκολο να ολοκληρωθεί με ένα μικρό διάλειμμα.',
  'workout.hill-8x45.name': 'Ανηφόρες 8 × 45 δλ',
  'workout.hill-8x45.blurb':
    '8 × 45 δλ δυνατά στην ανηφόρα (ή δυνατό πάτημα σε ίσιωμα) / 90 δλ χαλαρά. Δύναμη, τεχνική και ισχύς χωρίς καθαρή ταχύτητα στίβου — ιδανικό για ανηφόρες ή μέρες «ισχύος».',
  'workout.400-repeats.name': '6 × 400 μ',
  'workout.400-repeats.blurb':
    'Σύντομες γρήγορες επαναλήψεις με 90 δλ αποκατάσταση. Χτίζει ταχύτητα ποδιού, οικονομία και αναερόβια σπίθα — κλασική δουλειά ταχύτητας για 5Κ.',
  'workout.800-repeats.name': '5 × 800 μ',
  'workout.800-repeats.blurb':
    'Κλασικά ιντερβάλ μεσαίων αποστάσεων στον στίβο, με 2 λεπτά αποκατάσταση. VO₂ και έλεγχος ρυθμού γύρω στην προσπάθεια 3–5Κ — βασικό στην προετοιμασία αγώνα.',
  'workout.vo2-3min.name': '5 × 3 λεπτά',
  'workout.vo2-3min.blurb':
    'Δυνατά 3 λεπτά με ίση χαλαρή ξεκούραση. Στοχεύει τη μέγιστη αερόβια ικανότητα (VO₂) — ποιοτικό χτίσιμο φυσικής κατάστασης.',
  'workout.vo2-4x4.name': '4 × 4 λεπτά',
  'workout.vo2-4x4.blurb':
    'Κλασικά ιντερβάλ VO₂ 4×4 με ίση αποκατάσταση. Δυνατό ερέθισμα για το αερόβιο μέγιστο — καλύτερα όταν έχεις ήδη βάση.',

  'workout.custom.name': 'Δικό μου {repeats}×',
  'workout.custom.blurb': '{repeats} × {work} λεπτά / {rest} λεπτά ξεκούραση',
  'toast.workout': 'Προπόνηση: {name}',
  'workout.savedFallback': 'Αποθηκευμένη δική σου προπόνηση',
  'workout.customFallback': 'Φτιάξε τις δικές σου επαναλήψεις προσπάθειας / ξεκούρασης.',

  // --- Training plans -------------------------------------------------------
  'plan.start-to-run.name': 'Ξεκίνα να τρέχεις',
  'plan.start-to-run.blurb': '8 εβδομάδες από διαλείμματα περπατήματος σε σταθερό τζόγκινγκ 30 λεπτών. Τρεις μέρες την εβδομάδα.',
  'plan.first-5k.name': 'Πρώτα 5Κ',
  'plan.first-5k.blurb': '6 εβδομάδες με στόχο να καλύψεις 5 χλμ χωρίς άγχος. Μείγμα χαλαρών ημερών και μιας πιο μεγάλης προσπάθειας.',
  'plan.base-builder.name': 'Χτίσιμο βάσης',
  'plan.base-builder.blurb': '4 εβδομάδες σταθερού όγκου για όσους ήδη τρέχουν. Κυρίως χαλαρά, μία πιο μεγάλη μέρα.',
  'plan.return-to-run.name': 'Επιστροφή στο τρέξιμο',
  'plan.return-to-run.blurb': '3 ήπιες εβδομάδες μετά από διάλειμμα. Σύντομα, χαλαρά, αρκετά συχνά για να ξαναχτιστεί η συνήθεια.',

  'planSession.easyWithWalkBreaks.title': 'Χαλαρό με διαλείμματα περπατήματος',
  'planSession.easy.title': 'Χαλαρό',
  'planSession.longerEasy.title': 'Πιο μεγάλο χαλαρό',
  'planSession.longRun.title': 'Μεγάλο τρέξιμο',
  'planSession.easyOrStrides.title': 'Χαλαρό ή strides',
  'planSession.quality.title': 'Ποιοτική',

  'planSession.keepItConversationalShorterI.blurb': 'Κράτα το σε ρυθμό κουβέντας. Πιο σύντομο είναι μια χαρά.',
  'planSession.relaxedPaceAbout2030Minutes.blurb': 'Χαλαρός ρυθμός, γύρω στα 20–30 λεπτά.',
  'planSession.keepItLightOptionalShortStri.blurb': 'Κράτα το ελαφρύ. Προαιρετικά σύντομα strides στο τέλος.',
  'planSession.oneFocusedSessionTempoOrShor.blurb': 'Μία στοχευμένη προπόνηση — tempo ή σύντομες επαναλήψεις αν νιώθεις καλά.',
  'planSession.sameIdeaKeepItShort.blurb': 'Ίδια ιδέα, κράτα το σύντομο.',
  'planSession.finishTheWeekWithoutChasingP.blurb': 'Κλείσε την εβδομάδα χωρίς να κυνηγάς ρυθμό.',

  'planSession.aboutMinEasy.blurb': 'Περίπου {minutes} λεπτά χαλαρά, περπάτα όποτε χρειάζεται.',
  'planSession.buildPatience.blurb': 'Χτίσε υπομονή — στόχευσε γύρω στα {minutes} λεπτά συνολικά.',
  'planSession.buildToward5k.blurb': 'Χτίσε προς τα 5 χλμ — περίπου {km} χλμ αυτή την εβδομάδα.',
  'planSession.kmEasy.blurb': '~{km} χλμ χαλαρά.',
  'planSession.longAerobic.blurb': 'Μεγάλο αερόβιο — περίπου {km} χλμ.',
  'planSession.minutesEasyWalk.blurb': '{minutes} λεπτά χαλαρά. Επιτρέπονται διαλείμματα περπατήματος.',

  'planSession.gentlePickups.title': 'Ήπιες επιταχύνσεις',
  'planSession.finishQuicker.blurb':
    'Κλείσε με λίγα λεπτά ελαφρώς πιο γρήγορα — πάντα ελεγχόμενα.',
  'planSession.stayEasy.blurb': 'Μείνε χαλαρά. Η συνέπεια νικάει τους ηρωισμούς.',
  'planKind.easy': 'Χαλαρό',
  'planKind.long': 'Μεγάλο',
  'planKind.intervals': 'Ιντερβάλ',
  'planKind.tempo': 'Tempo',
  'planKind.rest': 'Ξεκούραση',
  'history.upcoming': 'επερχόμενη',
  'history.done': 'ολοκληρώθηκε',

  'splash.tagline': 'Τρέξιμο που μένει στη συσκευή σου',
  'splash.status': 'Ετοιμαζόμαστε…',
  'record.1km': '1 χλμ',
  'record.1mile': '1 μίλι',
  'record.5km': '5 χλμ',
  'record.10km': '10 χλμ',
  'record.half': 'Ημιμαραθώνιος',
  'record.marathon': 'Μαραθώνιος',

  'stats.title': 'Πίνακας',
  'stats.subtitle': {
    one: '{runs} τρέξιμο · {distance} {unit} συνολικά',
    other: '{runs} τρεξίματα · {distance} {unit} συνολικά',
  },
  'stats.streak': {
    one: 'σερί {count} ημέρας',
    other: 'σερί {count} ημερών',
  },
  'stats.thisWeek': 'Αυτή την εβδομάδα',
  'stats.time': 'Χρόνος',
  'stats.last12': 'Τελευταίες 12 εβδομάδες',
  'stats.records': 'Προσωπικά ρεκόρ',
  'stats.goal': 'Στόχος',
  'stats.goalProgress': '{distance} από {goal} {unit} αυτή την εβδομάδα',
  'stats.recordsHint':
    'Τα ρεκόρ βγαίνουν από τρεξίματα με GPS — το γρηγορότερο συνεχόμενο κομμάτι μέσα σε κάθε τρέξιμο, οπότε ένα γρήγορο 5άρι μέσα σε μεγαλύτερο τρέξιμο μετράει κανονικά.',

  // --- History --------------------------------------------------------------
  // Greek forms the possessive with the genitive, so "{name}’s runs" becomes
  // "the runs of {name}" — the placeholder has to move to the end.
  'history.title': 'Ιστορικό',
  'history.titleNamed': 'Τα τρεξίματα του/της {name}',
  'history.noRuns': 'Κανένα τρέξιμο ακόμη',
  'history.runsThisMonth': {
    one: '{count} τρέξιμο αυτόν τον μήνα',
    other: '{count} τρεξίματα αυτόν τον μήνα',
  },
  'history.runsTotal': {
    one: '{count} τρέξιμο',
    other: '{count} τρεξίματα',
  },
  'history.runsFiltered': '{count} από {total} τρεξίματα',
  'history.viewLabel': 'Προβολή ιστορικού',
  'history.filtersLabel': 'Γρήγορα φίλτρα',
  'history.filter.all': 'Όλα',
  'history.range.all': 'Όλος ο χρόνος',
  'history.range.week': 'Αυτή την εβδομάδα',
  'history.range.month': 'Αυτόν τον μήνα',
  'history.range.year': 'Φέτος',
  'history.extra.all': 'Οτιδήποτε',
  'history.extra.hr': 'Καρδιακοί παλμοί',
  'history.extra.workout': 'Προπόνηση',
  'history.extra.goal': 'Είχε στόχο',
  'history.group.week': 'Ανά εβδομάδα',
  'history.group.month': 'Ανά μήνα',
  'history.group.none': 'Απλή λίστα',
  'history.group.whenLabel': 'Πότε',
  'history.group.withLabel': 'Με',
  'run.outdoor': 'Έξω',
  'run.treadmill': 'Διάδρομος',

  // --- Live run pods --------------------------------------------------------
  // Pod labels sit under a large number in a narrow tile — length matters more
  // than completeness here, so these are the shortest honest words.
  'run.pod.steps': 'βήματα',
  'run.pod.incline': 'κλίση',
  'run.pod.pace': 'ρυθμός',
  'run.pod.avg': 'μ.ό.',
  'run.pod.laps': 'γύροι',
  'run.pod.spm': 'βήμ/λ',
  'run.pod.cadence': 'καντέντζα',

  // --- Treadmill console ----------------------------------------------------
  'run.console.title': 'Από την κονσόλα',
  'run.console.noDistance': 'Χωρίς απόσταση',
  'run.console.noIncline': 'Χωρίς κλίση',
  'run.console.inclineValue': 'κλίση {percent}%',
  'run.console.distanceLabel': 'Απόσταση ({unit}) — προαιρετικό',
  'run.console.inclineLabel': 'Κλίση (%) — προαιρετικό',
  'run.console.distanceHintPod': 'Η απόσταση της κονσόλας υπερισχύει του αισθητήρα και τον βαθμονομεί.',
  'run.console.distanceHintSteps': 'Υπερισχύει της εκτίμησης από βήματα και βαθμονομεί τον διασκελισμό.',

  // --- Treadmill panel ------------------------------------------------------
  'run.panel.label': 'Προβολή διαδρόμου',
  'run.panel.effort': 'Ένταση',
  'run.panel.splits': 'Splits',
  'run.effort.warmingUp': 'Χτίζεται η γραμμή — δώσε λίγα δευτερόλεπτα.',
  'run.effort.needSource':
    'Σύνδεσε ζώνη καρδιακών παλμών, ή άφησε τον μετρητή βημάτων να ξεκινήσει, και η ένταση θα σχεδιαστεί εδώ.',
  'run.effort.bpm': 'παλμοί',
  'run.effort.chartLabel': 'Ένταση στον χρόνο',
  'run.effort.range': 'Ελάχ. {low} · μέγ. {high}',
  'run.splits.empty': 'Πάτα Γύρος και κάθε split θα εμφανίζεται εδώ.',
  'run.laps.title': 'Γύροι',

  // --- Charts ---------------------------------------------------------------
  'common.close': 'Κλείσιμο',
  'chart.seriesLabel': 'Εμφάνιση σειρών',
  'chart.fullscreen': 'Πλήρης οθόνη',
  'chart.fullscreenChart': 'Γράφημα σε πλήρη οθόνη',
  'chart.exitFullscreen': 'Έξοδος από πλήρη οθόνη',
  'chart.fullscreenLabel': 'Γράφημα μετρήσεων τρεξίματος σε πλήρη οθόνη',
  'chart.plotLabel':
    'Καρδιακοί παλμοί, ρυθμός και ταχύτητα ανά απόσταση. Σύρε ή πάτα για να δεις τιμές.',
  'chart.readValues': 'Σύρε ή πάτα στο γράφημα για να δεις τιμές',
  'chart.axisHint': 'Πάτα ή σύρε στο γράφημα · ο άξονας x είναι η απόσταση',
  'chart.peakWeek': 'Κορυφαία εβδομάδα',
  'chart.km': 'Χλμ',
  'chart.mile': 'Μίλι',

  // --- Weight ---------------------------------------------------------------
  'weight.title': 'Βάρος',
  'weight.subtitle':
    'Κατέγραψε ζυγίσματα, βάλε στόχο και δες την τάση. Οι μετρήσεις εμφανίζονται και στο ημερολόγιο του Ιστορικού.',
  'weight.backToProfile': 'Πίσω στο προφίλ',
  'weight.startingTitle': 'Αρχικό βάρος',
  'weight.startingHint':
    'Γράψε ελεύθερα — τίποτα δεν αποθηκεύεται μέχρι να πατήσεις Αποθήκευση. Αυτό γίνεται η πρώτη σου καταγραφή και χρησιμοποιείται για την εκτίμηση θερμίδων στα τρεξίματα.',
  'weight.sinceFirst': 'Από την αρχή',
  'weight.atGoal': 'Είσαι στο βάρος-στόχο σου.',
  'weight.aboveGoal': '{amount} {unit} πάνω από τον στόχο.',
  'weight.belowGoal': '{amount} {unit} κάτω από τον στόχο.',
  'weight.logTitle': 'Κατέγραψε ζύγισμα',
  'weight.weightLabel': 'Βάρος ({unit})',
  'weight.noteLabel': 'Σημείωση (προαιρετικό)',
  'weight.notePlaceholder': 'Πρωί, μετά το τρέξιμο…',
  'weight.addToLog': 'Προσθήκη στο ημερολόγιο',
  'weight.goalTitle': 'Βάρος-στόχος',
  'weight.targetLabel': 'Στόχος ({unit})',
  'weight.optional': 'Προαιρετικό',
  'weight.clearHint': 'Καθάρισε το πεδίο και αποθήκευσε για να αφαιρέσεις τον στόχο.',
  'weight.trend': 'Τάση',
  'weight.noEntries': 'Καμία καταγραφή ακόμη.',
  'weight.goalCleared': 'Ο στόχος βάρους καθαρίστηκε.',
  'weight.entryRemoved': 'Η καταγραφή αφαιρέθηκε.',

  // --- Run detail -----------------------------------------------------------
  'common.back': 'Πίσω',
  'detail.decisionBanner':
    'Ολοκλήρωσε επιλέγοντας {save} ή {delete} — η πλοήγηση είναι κλειδωμένη ώστε να μην αφήσεις αυτό το τρέξιμο κατά λάθος.',
  'detail.moving': 'Σε κίνηση',
  'detail.avgBpm': 'Μ.ό. παλμών',
  'detail.maxBpm': 'Μέγ. παλμοί',
  'detail.minBpm': 'Ελάχ. παλμοί',
  'detail.hrReport': 'Αναφορά καρδιακών παλμών',
  'detail.zoneTime': 'Χρόνος σε κάθε ζώνη',
  'detail.zoneSaved': 'αποθηκεύτηκε με το τρέξιμο (μέγ. παλμοί {max})',
  'detail.zoneSamples': 'από δείγματα (μέγ. παλμοί {max})',
  'detail.zoneMeasured': '{time} μετρημένα',
  'detail.chartHr': 'Παλμοί, ρυθμός & ταχύτητα',
  'detail.chartPace': 'Ρυθμός & ταχύτητα',
  'detail.chartHrHint':
    'Ανά απόσταση. Πάτα μια σειρά για να την κρύψεις· σύρε στο γράφημα για να δεις τιμές.',
  'detail.chartPaceHint':
    'Από GPS — δεν υπήρχε ζώνη παλμών σε αυτό το τρέξιμο. Ο ρυθμός είναι ενεργός εξ ορισμού· άνοιξε και την Ταχύτητα αν τα θες μαζί.',
  'detail.coachNotes': 'Σημειώσεις από τον προπονητή',
  'detail.yourNote': 'Η σημείωσή σου',
  'detail.notePlaceholder': 'Πώς σου φάνηκε;',
  'detail.exportGpx': 'Εξαγωγή GPX',
  'detail.exportTcx': 'Εξαγωγή TCX',
  'detail.gpxDone': 'Το GPX κατέβηκε (με παλμούς όπου υπάρχουν).',
  'detail.tcxDone': 'Το TCX κατέβηκε — βολικό για Strava / Garmin.',
  'detail.noRoute': 'Δεν υπάρχει διαδρομή για αποθήκευση.',
  'detail.routeExists': 'Αυτή η διαδρομή είναι ήδη αποθηκευμένη.',
  'detail.routeSaved': 'Αποθηκεύτηκε η διαδρομή «{name}».',
  'detail.deleteForGood': 'Οριστική διαγραφή',

  // --- Coach screen ---------------------------------------------------------
  'coach.planStartFailed': 'Δεν ήταν δυνατή η έναρξη αυτού του πλάνου.',
  'coach.planStarted': 'Ξεκίνησε: {name}',
  'coach.planFallback': 'πλάνο',
  'coach.planCleared': 'Το πλάνο καθαρίστηκε.',
  'coach.ringLoad': 'Φορτίο',
  'coach.sevenDay': 'Φορτίο 7 ημερών',
  'coach.baseLoad': 'Φορτίο βάσης',
  'coach.acuteChronic': 'Οξύ:χρόνιο',
  'coach.loadNote':
    'Το φορτίο είναι ένα απλό σκορ από χρόνο και προσπάθεια (με παλμούς όπου υπάρχουν). Είναι οδηγός, όχι ιατρική μέτρηση.',
  'coach.planTitle': 'Πλάνο προπόνησης',
  'coach.endPlan': 'Τερματισμός πλάνου',
  'coach.nextSession': 'Επόμενη προπόνηση',
  'coach.tapSession': 'Πάτα μια προπόνηση για να τη σημειώσεις ως ολοκληρωμένη.',
  'coach.notes': 'Σημειώσεις προπονητή',

  // --- Coach guide ----------------------------------------------------------
  'coach.guide.title': 'Κατανοώντας τον Προπονητή',
  'coach.guide.subtitle':
    'Σύντομος οδηγός σε απλά λόγια για τους αριθμούς αποκατάστασης — δεν είναι ιατρική συμβουλή.',
  'coach.guide.whyTitle': 'Γιατί μετράει η αποκατάσταση',
  'coach.guide.whyBody':
    'Η σκληρή προπόνηση αποδίδει μόνο αν το σώμα προσαρμόζεται ανάμεσα στις προπονήσεις. Πολλή σκληρή δουλειά στοιβαγμένη πολύ κοντά ανεβάζει τον κίνδυνο τραυματισμού και κάνει το επόμενο τρέξιμο να μοιάζει άτονο. Οι χαλαρές μέρες και ο ύπνος είναι μέρος του πλάνου, όχι διάλειμμα από αυτό.',
  'coach.guide.freshNote': 'υπάρχει χώρος για ποιοτική προπόνηση αν νιώθεις καλά.',
  'coach.guide.balancedNote': 'κράτα τα περισσότερα τρεξίματα χαλαρά· οι σκληρές μέρες είναι προγραμματισμένες.',
  'coach.guide.loadedHigh': 'Φορτωμένος / Υψηλό',
  'coach.guide.loadedNote': 'χαμήλωσε όγκο και ένταση μέχρι να συνέλθεις.',
  'coach.guide.sevenDayBody':
    'Πόση καταπόνηση προπόνησης έχεις μαζέψει την τελευταία εβδομάδα. Βαθμολογεί κάθε τρέξιμο από χρόνο και προσπάθεια (παλμοί όπου υπάρχουν, αλλιώς ρυθμός). Πιο υψηλό σημαίνει περισσότερη πρόσφατη δουλειά — όχι «καλό» ή «κακό» από μόνο του.',
  'coach.guide.baseBody':
    'Ο πρόσφατος μέσος εβδομαδιαίος όγκος φορτίου σου (περίπου οι τελευταίες τέσσερις εβδομάδες). Σκέψου το ως το «κανονικό» της φυσικής σου κατάστασης. Όσοι μόλις ξεκίνησαν, με λίγο ιστορικό, θα δουν μικρή βάση — αυτό είναι αναμενόμενο.',
  'coach.guide.acuteTitle': 'Οξύ : χρόνιο',
  'coach.guide.acuteIntro': 'Ο λόγος του φορτίου αυτής της εβδομάδας ÷ τη βάση σου. Χονδρικά:',
  'coach.guide.under08': 'Κάτω από ~0,8',
  'coach.guide.under08Note': 'πιο ελαφρύ από το συνηθισμένο (φρεσκάρισμα / αποφόρτιση).',
  'coach.guide.steadyNote': 'σταθερό χτίσιμο.',
  'coach.guide.above15': 'Πάνω από ~1,5',
  'coach.guide.above15Note': 'απότομο άλμα· κλασικό παράθυρο κινδύνου αν ο όγκος είναι υψηλός.',
  'coach.guide.ratioCaveat':
    'Με λίγα μόνο χαλαρά τρεξίματα, ένας υψηλός λόγος μπορεί να φαίνεται τρομακτικός ενώ το απόλυτο φορτίο είναι ακόμη χαμηλό. Το RunLog σηματοδοτεί «υψηλό φορτίο» μόνο όταν η βάση είναι αρκετά στέρεη — και πάλι, άκου πώς νιώθεις.',
  'coach.guide.weeklyTitle': 'Εβδομαδιαία απόσταση & ρεκόρ',
  'coach.guide.weeklyBody':
    'Απλά σύνολα και προσωπικά ρεκόρ από τρεξίματα αποθηκευμένα σε αυτή τη συσκευή. Η μπάρα εβδομαδιαίου στόχου (αν έχεις ορίσει έναν στο Προφίλ) είναι στόχος απόστασης, ξεχωριστός από το φορτίο.',
  'coach.guide.plansTitle': 'Πλάνα προπόνησης',
  'coach.guide.plansBody':
    'Πολυεβδομαδιαία πρότυπα που τσεκάρεις με το χέρι. Καθοδηγούν τη δομή· δεν διαβάζουν αυτόματα το GPS σου για να εφεύρουν προπονήσεις.',
  'coach.guide.gotIt': 'Το κατάλαβα',

  // --- Settings: the rest ---------------------------------------------------
  'common.on': 'Ναι',
  'common.off': 'Όχι',
  'settings.units.title': 'Μονάδες',
  'settings.units.km': 'Χιλιόμετρα',
  'settings.units.miles': 'Μίλια',
  'settings.map.title': 'Χάρτης',
  'settings.map.hint': 'Χάρτης υποβάθρου για τις διαδρομές του ιστορικού.',
  'settings.map.hintLive':
    'Χάρτης υποβάθρου για τις διαδρομές του ιστορικού και τα ζωντανά τρεξίματα σε εξωτερικό χώρο.',
  'settings.map.autoNote': 'Αυτόματα → {basemap} με αυτό το θέμα.',
  'settings.map.styleLabel': 'Στυλ χάρτη',
  'settings.map.liveTiles': 'Πλακίδια χάρτη σε ζωντανό τρέξιμο',
  'settings.map.liveTilesHint':
    'Απενεργοποιημένο εξ ορισμού — γλιτώνει δεδομένα και κρατά την οθόνη απλή. Όταν είναι ενεργό, ο χάρτης φορτώνει το υπόβαθρο κατά την προετοιμασία και το τρέξιμο (χρειάζεται δίκτυο).',
  'settings.goal.title': 'Εβδομαδιαίος στόχος',
  'settings.goal.label': 'Απόσταση ανά εβδομάδα ({unit})',
  'settings.goal.hint':
    'Βάλε 0 για να απενεργοποιήσεις τον στόχο. Το σώμα και τα παπούτσια βρίσκονται στο Προφίλ.',
  'settings.strideLabel': 'Μήκος διασκελισμού (μ ανά βήμα)',
  'settings.duringRun': 'Κατά τη διάρκεια του τρεξίματος',
  'settings.keepAwake': 'Να μένει η οθόνη αναμμένη',
  'settings.audioCues': 'Φωνητικές οδηγίες',
  'settings.audioCuesHint':
    'Ανακοινώνει χιλιόμετρα/μίλια, πρόοδο στόχου, γύρους και παύση/συνέχεια. Χρησιμοποιεί τη φωνή του τηλεφώνου (λειτουργεί χωρίς σύνδεση).',
  'settings.haptics': 'Δόνηση',
  'settings.hapticsHint':
    'Σύντομη δόνηση όταν κάτι αλλάζει (καρτέλες, ρυθμίσεις). Όχι σε κάθε άγγιγμα.',
  'settings.autoPause': 'Αυτόματη παύση',
  'settings.autoPauseHint':
    'Κάνει παύση όταν σταματάς (GPS σε εξωτερικό χώρο ή αισθητήρας ποδιού σε διάδρομο) και συνεχίζει μόλις ξεκινήσεις πάλι.',
  'settings.footpod.title': 'Αισθητήρας ποδιού',
  'settings.footpod.correction': 'Διόρθωση απόστασης',
  'settings.routes.title': 'Αποθηκευμένες διαδρομές',
  'settings.routes.empty': 'Καμία αποθηκευμένη διαδρομή ακόμη.',
  'settings.routeDeleted': 'Η διαδρομή διαγράφηκε.',
  'settings.data.title': 'Τα δεδομένα σου',
  'settings.backup.done':
    'Κατέβηκε πλήρες αντίγραφο ασφαλείας (τρεξίματα, προφίλ, παπούτσια, διαδρομές, πλάνο).',
  'settings.backup.unreadable': 'Δεν ήταν δυνατή η ανάγνωση αυτού του αρχείου.',
  'settings.gpxFailed': 'Η εισαγωγή GPX απέτυχε.',
  'settings.wiped':
    'Όλα τα τρεξίματα, τα παπούτσια, οι διαδρομές και το πλάνο διαγράφηκαν. Το προφίλ διατηρήθηκε.',
  'settings.hc.androidOnly': 'Η εισαγωγή από το Health Connect λειτουργεί μόνο στην εφαρμογή Android.',
  'settings.hc.noneFound': 'Δεν βρέθηκαν τρεξίματα σε αυτό το εύρος ημερομηνιών.',
  'settings.hc.scanFailed': 'Η σάρωση του Health Connect απέτυχε.',
  'settings.hc.selectOne': 'Διάλεξε τουλάχιστον ένα τρέξιμο για εισαγωγή.',
  'settings.hc.nothingNew': 'Δεν εισήχθη κάτι νέο.',
  'settings.hc.importFailed': 'Η εισαγωγή από το Health Connect απέτυχε.',

  // --- Profile --------------------------------------------------------------
  'profile.defaultName': 'Δρομέα',
  'profile.subtitle': 'Το σώμα σου, οι ζώνες και τα παπούτσια — όλα σε αυτή τη συσκευή.',
  'profile.lifetime': 'Συνολικά χιλιόμετρα',
  'profile.totalUnit': '{unit} σύνολο',
  'profile.runs': 'Τρεξίματα',
  'profile.longest': 'Μακρύτερο',
  'profile.lifetimeHint':
    'Άθροισμα κάθε αποθηκευμένου τρεξίματος σε αυτή τη συσκευή (ενημερώνεται όταν τερματίζεις ή διαγράφεις).',
  'profile.name': 'Όνομα',
  'profile.namePlaceholder': 'π.χ. Αλέξης',
  'profile.birthDate': 'Ημερομηνία γέννησης',
  'profile.birthHint':
    'Η ηλικία υπολογίζεται αυτόματα για τους μέγιστους παλμούς και τις θερμίδες.',
  'profile.currentAge': {
    one: 'Τώρα {years} έτος.',
    other: 'Τώρα {years} έτη.',
  },
  'profile.heightLabel': 'Ύψος (εκ)',
  'profile.heightPlaceholder': 'π.χ. 175',
  'profile.clearHint':
    'Μπορείς να αδειάσεις το πεδίο όσο γράφεις — τίποτα δεν αποθηκεύεται μέχρι να πατήσεις Αποθήκευση.',
  'profile.sexLabel': 'Φύλο (για την εκτίμηση θερμίδων)',
  'profile.female': 'Γυναίκα',
  'profile.male': 'Άνδρας',
  'profile.sexHint': 'Χρησιμοποιείται από το μοντέλο θερμίδων με βάση τους παλμούς (Keytel).',
  'profile.age': 'Ηλικία',
  'profile.height': 'Ύψος',
  'profile.sex': 'Φύλο',
  'profile.edit': 'Επεξεργασία',
  'profile.saved': 'Το προφίλ αποθηκεύτηκε.',
  'profile.savedNamed': 'Το προφίλ αποθηκεύτηκε · {name}.',
  'profile.invalidBirth': 'Δώσε έγκυρη ημερομηνία γέννησης.',
  'profile.invalidHeight': 'Το ύψος πρέπει να είναι μεταξύ 80 και 250 εκ.',
  'profile.currentUnit': 'Τώρα {unit}',
  'profile.goalUnit': 'Στόχος {unit}',
  'profile.weightHint':
    'Τα ζυγίσματα ενημερώνουν τις εκτιμήσεις θερμίδων και εμφανίζονται στο ημερολόγιο του Ιστορικού.',
  'profile.setUpWeight': 'Ρύθμισε το ημερολόγιο βάρους',
  'profile.openWeight': 'Άνοιξε το ημερολόγιο βάρους',
  'profile.zones': 'Ζώνες καρδιακών παλμών',
  'profile.maxHr': 'Μέγιστοι καρδιακοί παλμοί (bpm)',
  'profile.shoes.title': 'Παπούτσια',
  'profile.shoes.empty': 'Κανένα παπούτσι ακόμη — πάτα Προσθήκη ζευγαριού.',
  'profile.shoes.add': 'Προσθήκη ζευγαριού',
  'profile.shoes.edit': 'Επεξεργασία ζευγαριού',
  'profile.shoes.brand': 'Μάρκα (προαιρετικό)',
  'profile.shoes.limit': 'Όριο χρήσης ({unit})',
  'profile.shoes.mileageHint':
    'Τα χιλιόμετρα δεν αλλάζουν εδώ — αυξάνονται μόνο όταν τερματίζεις τρεξίματα με αυτά τα παπούτσια.',
  'profile.shoes.savePair': 'Αποθήκευση ζευγαριού',
  'profile.shoes.saveChanges': 'Αποθήκευση αλλαγών',
  'profile.shoes.retire': 'Απόσυρση',
  'profile.shoes.restore': 'Επαναφορά',
  'profile.shoes.needName': 'Δώσε ένα όνομα στα παπούτσια.',
  'profile.shoes.updated': 'Τα παπούτσια ενημερώθηκαν.',
};
