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
