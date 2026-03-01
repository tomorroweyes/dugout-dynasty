/**
 * Text Pools for Dynamic Narrative Generation
 *
 * Provides verb and adjective pools scaled by player stats
 * to create epic RPG-style play-by-play descriptions
 */

// ============================================
// POWER-SCALED VERBS (for hitting)
// ============================================

export interface VerbPool {
  low: string[];      // Power < 50
  mid: string[];      // Power 50-80
  high: string[];     // Power 80-100
  legendary: string[]; // Power 100+
}

export const POWER_VERBS: VerbPool = {
  low: [
    "taps",
    "pokes",
    "nudges",
    "dinks",
    "bunts",
    "tickles",
    "grazes",
    "chips",
  ],
  mid: [
    "drives",
    "smashes",
    "crushes",
    "rips",
    "rockets",
    "hammers",
    "blasts",
    "pounds",
  ],
  high: [
    "OBLITERATES",
    "DEMOLISHES",
    "ANNIHILATES",
    "DESTROYS",
    "PULVERIZES",
    "VAPORIZES",
    "SHATTERS",
    "ATOMIZES",
  ],
  legendary: [
    "DISINTEGRATES",
    "ERASES FROM EXISTENCE",
    "BANISHES TO THE SHADOW REALM",
    "SENDS INTO ORBIT",
    "TEARS A HOLE IN REALITY WITH",
    "UNLEASHES ARMAGEDDON UPON",
  ],
};

// ============================================
// CONTACT-SCALED VERBS (for precision)
// ============================================

export const CONTACT_VERBS: VerbPool = {
  low: [
    "swings wildly at",
    "flails at",
    "whiffs on",
    "chases",
    "lunges for",
  ],
  mid: [
    "connects with",
    "meets",
    "finds",
    "squares up",
    "times",
  ],
  high: [
    "perfectly times",
    "surgically places",
    "expertly guides",
    "threads",
    "lasers",
  ],
  legendary: [
    "achieves PERFECT CONTACT with",
    "reaches enlightenment and connects with",
    "bends space-time to meet",
    "achieves NIRVANA upon contact with",
  ],
};

// ============================================
// HIT RESULT ADJECTIVES
// ============================================

export const HIT_ADJECTIVES = {
  single: [
    "a solid",
    "a clean",
    "a sharp",
    "a crisp",
    "a well-placed",
  ],
  double: [
    "a booming",
    "a ringing",
    "a scorching",
    "a blistering",
    "a thunderous",
  ],
  triple: [
    "an EXPLOSIVE",
    "a DEVASTATING",
    "a MONSTROUS",
    "an EARTH-SHATTERING",
    "a COLOSSAL",
  ],
  homerun: [
    "an APOCALYPTIC",
    "a CATACLYSMIC",
    "a REALITY-BENDING",
    "a DIMENSION-CROSSING",
    "a LEGENDARY",
    "an ATOMIC",
  ],
};

// ============================================
// BALL DESCRIPTIONS
// ============================================

export const BALL_DESCRIPTORS = {
  low: [
    "the ball",
    "the pitch",
    "the offering",
  ],
  mid: [
    "the white leather sphere",
    "the fastball",
    "the heater",
  ],
  high: [
    "the BLAZING COMET",
    "the MISSILE",
    "the THUNDERBOLT",
  ],
  legendary: [
    "the COSMIC ORB OF DESTINY",
    "the SPHERE OF ABSOLUTE POWER",
    "the BALL THAT MERE MORTALS FEAR",
  ],
};

// ============================================
// STRIKEOUT DESCRIPTIONS
// ============================================

export const STRIKEOUT_TEXTS = {
  pitcher_low: [
    "{batter} swings and misses. Strike three!",
    "{batter} goes down swinging.",
    "{batter} is caught looking. Strike three!",
  ],
  pitcher_mid: [
    "{pitcher} blows it past {batter}! Strike three!",
    "{batter} can't catch up to the heat! Strikeout!",
    "{pitcher} paints the corner. {batter} is frozen!",
  ],
  pitcher_high: [
    "{pitcher} DESTROYS {batter} with a FILTHY pitch! STRIKEOUT!",
    "{batter} swings at AIR! {pitcher} is UNSTOPPABLE!",
    "{pitcher} makes {batter} look SILLY! The bat never had a chance!",
  ],
  pitcher_legendary: [
    "{pitcher} channels the ANCIENT BASEBALL GODS and OBLITERATES {batter}!",
    "That pitch VIOLATED the laws of physics! {batter} never saw it coming!",
    "{pitcher} achieves BASEBALL ENLIGHTENMENT! {batter} is sent to the SHADOW REALM!",
  ],
};

// ============================================
// WALK DESCRIPTIONS
// ============================================

export const WALK_TEXTS = {
  control_low: [
    "{pitcher} can't find the zone. {batter} draws a walk.",
    "{pitcher} issues a free pass to {batter}.",
    "{batter} works a walk. {pitcher} struggling with control.",
  ],
  control_mid: [
    "{batter} lays off tough pitches and earns a walk.",
    "{pitcher} misses just enough. {batter} takes first base.",
  ],
  control_high: [
    "{batter} displays ELITE plate discipline! Walk!",
    "{pitcher} respects {batter}'s power and issues an intentional walk.",
  ],
};

// ============================================
// OUT DESCRIPTIONS
// ============================================

export const OUT_TEXTS = {
  groundout: [
    "{batter} grounds out.",
    "{batter} hits a weak grounder. Easy out.",
    "{batter} rolls one to the infield. Out at first.",
    "Routine grounder. {batter} is retired.",
  ],
  flyout: [
    "{batter} flies out.",
    "{batter} lifts it to the outfield. Caught for out number {outs}.",
    "Lazy fly ball. {batter} is out.",
    "{batter} gets under it. Easy fly ball out.",
  ],
  lineout: [
    "{batter} lines out.",
    "Sharp liner! But right at a defender. {batter} is out.",
    "{batter} rockets one... right into a glove. Tough luck.",
    "Line drive out. {batter} hit it hard, but no luck.",
  ],
  popout: [
    "{batter} pops out.",
    "Popup in foul territory. {batter} is out.",
    "{batter} gets jammed. Weak popup for out number {outs}.",
  ],
};

// ============================================
// APPROACH & STRATEGY FLAVOR
// Tokens: {batter}, {pitcher}
// Add new strings freely — engine picks one at random each time.
// ============================================

export const APPROACH_TEXTS = {
  /** Batter approach: power swing */
  batterPower: [
    "{batter} digs in, looking to drive one.",
    "{batter} widens his stance. He's hunting.",
    "Looking for something to pull — {batter} digs in.",
    "{batter} is swinging big here.",
    "Hacking mode: {batter} is sitting on a fastball.",
  ],

  /** Batter approach: patient / walk the zone */
  batterPatient: [
    "{batter} takes a patient approach.",
    "{batter} works the count.",
    "Plate discipline on display — {batter} lays off.",
    "{batter} is in no hurry here.",
    "Taking pitches: {batter} works the at-bat.",
  ],

  /** Pitcher strategy: finesse / mix speeds */
  pitcherFinesse: [
    "{pitcher} mixes speeds.",
    "{pitcher} keeps the hitter off-balance.",
    "Changing speeds — {pitcher} works the sequence.",
    "{pitcher} paints with different looks.",
    "Off-speed and away — {pitcher} goes to the well.",
  ],

  /** Pitcher strategy: paint corners */
  pitcherPaint: [
    "{pitcher} works the corners.",
    "{pitcher} nibbles. Living on the edges.",
    "Precision mode: {pitcher} targets the black.",
    "{pitcher} threads the needle.",
    "High and tight, down and away — {pitcher} mixing locations.",
  ],

  /** Zone read natural 20 — batter guessed perfectly */
  perfectContact: [
    "{batter} reads it perfectly —",
    "{batter} was all over that pitch —",
    "Dead red, right location — {batter} locks in —",
    "{batter} guessed right. All of it —",
    "Called it. {batter} was sitting on exactly that —",
  ],

  /** Zone read painted corner — pitcher won the exchange */
  paintedCorner: [
    "{pitcher} paints the corner — no chance.",
    "{pitcher} hits the spot. {batter} had no read on that.",
    "Perfect execution — {pitcher} was unhittable there.",
    "Right where he wanted it. {pitcher} owns that corner.",
    "{pitcher} freezes {batter}. Wasn't going to hit that.",
  ],
};

// ============================================
// BATTER GAME HISTORY CONTEXT
// Tokens: {name} = surname, {abs} = at-bats, {k} = strikeouts, {hits} = hits
// Add new strings freely — engine picks one at random each time.
// ============================================

export const BATTER_HISTORY_TEXTS = {
  /** 0-for-3+ with 2+ strikeouts — full redemption arc setup */
  redemption: [
    "{name}, 0-for-{abs} with {k} strikeouts, steps in with something to prove.",
    "Looking for redemption — {name} is oh-for-{abs} on the day.",
    "The crowd's watching {name}. {k} punchouts already today.",
    "Oh-for-{abs} so far. {name} needs something here.",
    "{name} hasn't found the barrel all game. {k} Ks. This one matters.",
    "A rough day for {name} — 0-for-{abs}, {k} strikeouts. Time to change that.",
    "{name} digs in. 0-for-{abs} today. Redemption knocks.",
  ],

  /** 0-for-X, no hits but not necessarily multiple Ks */
  hitless: [
    "{name}, hitless today, steps back in.",
    "Still looking for the first hit — {name} 0-for-{abs}.",
    "{name} hasn't found one yet. 0-for-{abs} on the day.",
    "No hits yet for {name}.",
    "{name} is searching. 0-for-{abs} so far.",
    "Oh-for-{abs} for {name}. A hit would change everything.",
    "{name} steps in. Hitless today — that could change right now.",
  ],

  /** Multiple Ks but not necessarily hitless */
  struggling: [
    "{name}, who has been battling all game, tries again.",
    "It's been a tough one for {name}.",
    "{name} has been in rough spots all night.",
    "Another big moment for {name} to turn it around.",
    "{name} keeps coming up. {k} strikeouts already today, but still fighting.",
    "{name} digs in. The plate hasn't been kind today.",
    "Tough day for {name} at the dish. Not done yet though.",
  ],

  /** Hot — 2+ hits, on a roll */
  hot: [
    "{name}, swinging the hot bat today,",
    "{name} already with {hits} hits — locked in.",
    "Don't sleep on {name}. {hits} for {abs} so far.",
    "{name} has been on fire all game.",
    "Hot bat at the plate — {name} already with {hits} hits today.",
    "{name} is seeing it well. {hits} hits on the day.",
    "{hits} hits in {abs} trips. {name} is dealing.",
  ],
};

// ============================================
// SITUATIONAL FLAVOR TEXT
// ============================================

export const CLUTCH_INTROS = [
  "With runners in scoring position...",
  "The crowd holds its breath...",
  "THIS IS THE MOMENT...",
  "Everything on the line...",
];

export const ERROR_TEXTS = [
  "OH NO! {fielder} BOOTS IT! Error!",
  "{fielder} channels their inner Little League and drops it!",
  "A tragic display of Dexterity failure by {fielder}!",
  "{fielder} trips over their own shoelaces! ERROR!",
  "The ball and {fielder}'s glove are in different dimensions!",
];

export const CRITICAL_HIT_PREFIXES = [
  "⚡ CRITICAL HIT! ⚡",
  "💥 MASSIVE DAMAGE! 💥",
  "🔥 SUPER EFFECTIVE! 🔥",
  "✨ LEGENDARY STRIKE! ✨",
];

// ============================================
// NEAR-MISS PSYCHOLOGY
// ============================================

export const NEAR_MISS_TEXTS = [
  "SO CLOSE! The ball hits the top of the wall!",
  "JUST FOUL! By inches!",
  "The ball grazes the foul pole! So close to a home run!",
  "ROBBERY! The outfielder makes an incredible catch at the wall!",
  "Strike three... but the catcher drops it! You're safe!",
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get verb tier based on stat value
 */
export function getVerbTier(statValue: number): keyof VerbPool {
  if (statValue >= 100) return "legendary";
  if (statValue >= 80) return "high";
  if (statValue >= 50) return "mid";
  return "low";
}

/**
 * Select random item from array
 */
export function randomChoice<T>(array: T[], rng: { random: () => number } = Math): T {
  return array[Math.floor(rng.random() * array.length)];
}
