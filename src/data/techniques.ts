/**
 * Technique Definitions
 *
 * Baseball-themed abilities for each archetype.
 * Techniques define what players can DO, not just their stats.
 *
 * DESCRIPTION CONVENTION:
 * - description: Mechanical explanation of what the skill does in gameplay terms.
 *   Players should understand the actual impact from reading this.
 * - flavorText: Fun thematic text for atmosphere.
 *
 * EFFECT NAMING:
 * - strikeoutBonus: Additive to K chance. Positive = more Ks, negative = fewer Ks.
 * - walkBonus: Additive to walk chance. Positive = more walks.
 * - homerunBonus: Additive to hit roll. Positive = more HRs.
 * - hitBonus: Additive to net score. Positive = better hit quality (more XBH).
 */

import type { Technique } from "@/types/ability";

// ============================================
// SLUGGER TECHNIQUES (Power Hitter)
// ============================================

export const SLUGGER_TECHNIQUES: Technique[] = [
  {
    id: "moonshot",
    name: "Moonshot",
    description: "Swing for the fences. Bypasses normal hitting — 55% home run, 45% strikeout. Nothing in between.",
    flavorText: "The ball either disappears... or you do.",
    spiritCost: 20,
    slotCost: 1,
    requiredClass: "Slugger",
    requiredLevel: 5,
    path: "Core",
    tags: ["offensive", "power", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "homerun",
        successChance: 55,
        outcomes: [
          { result: "homerun", chance: 55 },
          { result: "strikeout", chance: 45 },
        ],
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🌙",
    synergyEnhancement: {
      requiredSynergy: "murderers_row",
      requiredTier: "bronze",
      bonusEffects: [{ type: "outcome_modifier", homerunBonus: 5 }],
      enhancedDescription: "+5% HR chance with Murderers' Row",
    },
  },
  {
    id: "intimidation_factor",
    name: "Intimidation Factor",
    description: "Your power reputation forces pitchers to nibble. +25% walk chance — they'd rather give you first than throw a strike.",
    flavorText: "Pitchers are scared to throw you strikes.",
    spiritCost: 12,
    slotCost: 1,
    requiredClass: "Slugger",
    requiredLevel: 7,
    path: "Presence Path",
    tags: ["offensive", "strategic"],
    conflictsWith: ["opposite_field"],
    effects: [
      {
        type: "outcome_modifier",
        walkBonus: 25,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "😤",
  },
  {
    id: "opposite_field",
    name: "Opposite Field",
    description: "Trade power for consistency. +15 hit quality for more singles and doubles, -10% strikeout chance, but -8% home run chance.",
    flavorText: "Line drives to all fields. Not sexy, but effective.",
    spiritCost: 15,
    slotCost: 1,
    requiredClass: "Slugger",
    requiredLevel: 7,
    path: "Balanced Path",
    tags: ["offensive", "versatile"],
    conflictsWith: ["intimidation_factor"],
    effects: [
      {
        type: "outcome_modifier",
        hitBonus: 15,
        strikeoutBonus: -10,
        homerunBonus: -8,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "↗️",
  },
  {
    id: "home_run_threat",
    name: "Home Run Threat",
    description: "Pitchers either walk you or make a mistake you crush. +25% home run chance, +15% walk chance.",
    flavorText: "Every at-bat is a lose-lose for the pitcher.",
    spiritCost: 30,
    slotCost: 2,
    requiredClass: "Slugger",
    requiredLevel: 10,
    prerequisiteAbilityId: "moonshot",
    path: "Power Path",
    tags: ["offensive", "power"],
    effects: [
      {
        type: "outcome_modifier",
        homerunBonus: 25,
        walkBonus: 15,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🌟",
  },
  {
    id: "uppercut_swing",
    name: "Uppercut Swing",
    description: "Sell out for launch angle. +20% home run chance, but +10% strikeout chance. High risk, high reward.",
    flavorText: "Three true outcomes, baby.",
    spiritCost: 20,
    slotCost: 1,
    requiredClass: "Slugger",
    requiredLevel: 12,
    path: "Power Path",
    tags: ["offensive", "power", "risky"],
    effects: [
      {
        type: "outcome_modifier",
        homerunBonus: 20,
        strikeoutBonus: 10,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "⬆️",
  },
  {
    id: "gorilla_ball",
    name: "Gorilla Ball",
    description: "Raw fury for the entire inning. +40 power and +15 contact for all at-bats this inning, plus +10% home run chance.",
    flavorText: "The dugout energy is ELECTRIC.",
    spiritCost: 30,
    slotCost: 2,
    requiredClass: "Slugger",
    requiredLevel: 15,
    prerequisiteAbilityId: "moonshot",
    path: "Power Path",
    tags: ["ultimate", "power", "inning-duration"],
    effects: [
      {
        type: "stat_modifier",
        power: 40,
        contact: 15,
        duration: "inning",
      },
      {
        type: "outcome_modifier",
        homerunBonus: 10,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🦍",
    synergyEnhancement: {
      requiredSynergy: "murderers_row",
      requiredTier: "silver",
      bonusEffects: [{ type: "stat_modifier", power: 5, duration: "inning" }],
      enhancedDescription: "+5 additional power with Murderers' Row (Silver)",
    },
  },
];

// ============================================
// CONTACT HITTER TECHNIQUES
// ============================================

export const CONTACT_HITTER_TECHNIQUES: Technique[] = [
  {
    id: "two_strike_assassin",
    name: "Two-Strike Assassin",
    description: "Choke up and poke it. Bypasses normal hitting — 70% single, 20% double, 10% out. If clashing with a pitcher ability, also -30% strikeout chance.",
    flavorText: "I'm down 0-2 and I'm not worried.",
    spiritCost: 15,
    slotCost: 1,
    requiredClass: "Contact Hitter",
    requiredLevel: 5,
    path: "Core",
    tags: ["offensive", "consistency", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "single",
        successChance: 70,
        outcomes: [
          { result: "single", chance: 70 },
          { result: "double", chance: 20 },
          { result: "out", chance: 10 },
        ],
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: -30,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎯",
    synergyEnhancement: {
      requiredSynergy: "ironclad",
      requiredTier: "bronze",
      bonusEffects: [{ type: "outcome_modifier", hitBonus: 10 }],
      enhancedDescription: "+10% single chance with Ironclad",
    },
  },
  {
    id: "patience",
    name: "Patience",
    description: "Passive. +15 contact all game (fewer Ks, more walks, better hits). Also +15% walk chance directly. Available to any archetype.",
    flavorText: "Only swing at good pitches.",
    spiritCost: 0,
    slotCost: 1,
    requiredClass: "Contact Hitter",
    requiredLevel: 7,
    isPassive: true,
    allowCrossArchetype: true,
    path: "Discipline Path",
    tags: ["utility", "passive", "cross-archetype"],
    effects: [
      {
        type: "stat_modifier",
        contact: 15,
        duration: "game",
      },
      {
        type: "outcome_modifier",
        walkBonus: 15,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "👁️",
    synergyEnhancement: {
      requiredSynergy: "eagle_eye",
      requiredTier: "bronze",
      bonusEffects: [{ type: "stat_modifier", contact: 5, duration: "game" }],
      enhancedDescription: "+5 additional contact with Eagle Eye",
    },
  },
  {
    id: "gold_glove",
    name: "Gold Glove",
    description: "Elite defense all game. +30 to your glove rating, and +15 to team defense during your at-bats. Turns hits into outs.",
    flavorText: "Defense wins championships.",
    spiritCost: 20,
    slotCost: 1,
    requiredClass: "Contact Hitter",
    requiredLevel: 8,
    path: "Defense Path",
    tags: ["defensive"],
    effects: [
      {
        type: "stat_modifier",
        glove: 30,
        duration: "game",
      },
      {
        type: "defensive_boost",
        gloveBonus: 15,
        duration: "at_bat",
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🧤",
    synergyEnhancement: {
      requiredSynergy: "iron_curtain",
      requiredTier: "silver",
      bonusEffects: [{ type: "stat_modifier", glove: 10, duration: "game" }],
      enhancedDescription: "+10 additional glove with Iron Curtain (Silver)",
    },
  },
  {
    id: "spray_chart",
    name: "Spray Chart",
    description: "Find the gaps. +20 hit quality for more singles and doubles, but -5% home run chance. Consistency over power.",
    flavorText: "You see holes in every defense.",
    spiritCost: 14,
    slotCost: 1,
    requiredClass: "Contact Hitter",
    requiredLevel: 10,
    path: "Placement Path",
    tags: ["offensive", "strategic"],
    effects: [
      {
        type: "outcome_modifier",
        hitBonus: 20,
        homerunBonus: -5,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "📊",
  },
  {
    id: "battle_mode",
    name: "Battle Mode",
    description: "Refuse to strike out. +30 contact (fewer Ks, more walks, better hits) and -20% strikeout chance on top of that.",
    flavorText: "You will not go down without a fight.",
    spiritCost: 20,
    slotCost: 1,
    requiredClass: "Contact Hitter",
    requiredLevel: 12,
    path: "Discipline Path",
    tags: ["offensive", "consistency"],
    effects: [
      {
        type: "stat_modifier",
        contact: 30,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: -20,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "⚔️",
  },
  {
    id: "rally_igniter",
    name: "Rally Igniter",
    description: "Fire up the entire inning. +25 contact for all at-bats this inning, -20% strikeout chance, +10% walk chance, +10 hit quality.",
    flavorText: "The lineup feeds off your energy.",
    spiritCost: 25,
    slotCost: 2,
    requiredClass: "Contact Hitter",
    requiredLevel: 15,
    prerequisiteAbilityId: "two_strike_assassin",
    path: "Discipline Path",
    tags: ["ultimate", "consistency", "inning-duration"],
    effects: [
      {
        type: "stat_modifier",
        contact: 25,
        duration: "inning",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: -20,
        walkBonus: 10,
        hitBonus: 10,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🔥",
  },
];

// ============================================
// SPEED DEMON TECHNIQUES
// ============================================

export const SPEED_DEMON_TECHNIQUES: Technique[] = [
  {
    id: "crazy_bunt",
    name: "Crazy Bunt",
    description: "Drop a perfect bunt. Bypasses normal hitting — 80% single, 10% double, 10% out.",
    flavorText: "The defense never saw it coming.",
    spiritCost: 10,
    slotCost: 1,
    requiredClass: "Speed Demon",
    requiredLevel: 5,
    path: "Core",
    tags: ["offensive", "speed", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "single",
        successChance: 80,
        outcomes: [
          { result: "single", chance: 80 },
          { result: "double", chance: 10 },
          { result: "out", chance: 10 },
        ],
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "💨",
    synergyEnhancement: {
      requiredSynergy: "greased_lightning",
      requiredTier: "bronze",
      bonusEffects: [{ type: "outcome_modifier", hitBonus: 5 }],
      enhancedDescription: "+5% double chance with Greased Lightning",
    },
  },
  {
    id: "slap_hitter",
    name: "Slap Hitter",
    description: "Boost your bat across the board. +10 power, +15 contact, +12 hit quality. Better contact, fewer Ks, and more extra-base hits.",
    flavorText: "Just get on base.",
    spiritCost: 15,
    slotCost: 1,
    requiredClass: "Speed Demon",
    requiredLevel: 7,
    path: "Contact Path",
    tags: ["offensive", "contact"],
    conflictsWith: ["pest"],
    effects: [
      {
        type: "stat_modifier",
        power: 10,
        contact: 15,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        hitBonus: 12,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "👋",
  },
  {
    id: "pest",
    name: "Pest",
    description: "Make yourself impossible to retire. -20% strikeout chance and +12% walk chance. Pure on-base annoyance.",
    flavorText: "Foul off everything. Work every count. Be a nightmare.",
    spiritCost: 10,
    slotCost: 1,
    requiredClass: "Speed Demon",
    requiredLevel: 7,
    path: "Chaos Path",
    tags: ["offensive", "patience"],
    conflictsWith: ["slap_hitter"],
    effects: [
      {
        type: "outcome_modifier",
        strikeoutBonus: -20,
        walkBonus: 12,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🪰",
  },
  {
    id: "havoc",
    name: "Havoc",
    description: "Your speed rattles the defense. +20 hit quality turns weak contact into extra-base hits, plus +10% walk chance as the pitcher rushes.",
    flavorText: "The pitcher can't concentrate with you at the plate.",
    spiritCost: 14,
    slotCost: 1,
    requiredClass: "Speed Demon",
    requiredLevel: 10,
    path: "Chaos Path",
    tags: ["offensive", "disruption", "strategic"],
    effects: [
      {
        type: "outcome_modifier",
        hitBonus: 20,
        walkBonus: 10,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🌪️",
  },
  {
    id: "hit_and_run",
    name: "Hit and Run",
    description: "Execute perfectly. +20 contact to put the ball in play, +15 hit quality to find the gaps. Turns singles into doubles.",
    flavorText: "Move the runners, make things happen.",
    spiritCost: 18,
    slotCost: 1,
    requiredClass: "Speed Demon",
    requiredLevel: 12,
    path: "Contact Path",
    tags: ["offensive", "strategic"],
    effects: [
      {
        type: "stat_modifier",
        contact: 20,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        hitBonus: 15,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🏃",
  },
  {
    id: "steal_the_show",
    name: "Steal the Show",
    description: "Total chaos for the entire inning. +20 contact (inning), +15 hit quality, +10% walk chance, -15% strikeout chance.",
    flavorText: "You are a nightmare for opposing defenses.",
    spiritCost: 25,
    slotCost: 2,
    requiredClass: "Speed Demon",
    requiredLevel: 15,
    prerequisiteAbilityId: "crazy_bunt",
    path: "Chaos Path",
    tags: ["ultimate", "speed", "inning-duration"],
    effects: [
      {
        type: "stat_modifier",
        contact: 20,
        duration: "inning",
      },
      {
        type: "outcome_modifier",
        hitBonus: 15,
        walkBonus: 10,
        strikeoutBonus: -15,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "⚡",
  },
];


// ============================================
// FLAMETHROWER TECHNIQUES (Dominant Power Pitcher)
// ============================================

export const FLAMETHROWER_TECHNIQUES: Technique[] = [
  {
    id: "heat_up",
    name: "Heat Up",
    description: "Dial it up. Bypasses normal pitching — 65% strikeout, 25% weak contact out, 10% single.",
    flavorText: "They can't hit what they can't see.",
    spiritCost: 15,
    slotCost: 1,
    requiredClass: "Flamethrower",
    requiredLevel: 5,
    path: "Core",
    tags: ["power", "velocity", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "strikeout",
        successChance: 65,
        outcomes: [
          { result: "strikeout", chance: 65 },
          { result: "out", chance: 25 },
          { result: "single", chance: 10 },
        ],
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🔥",
    synergyEnhancement: {
      requiredSynergy: "furnace",
      requiredTier: "bronze",
      bonusEffects: [{ type: "outcome_modifier", strikeoutBonus: 5 }],
      enhancedDescription: "+5% strikeout chance with Furnace",
    },
  },
  {
    id: "intimidation",
    name: "Intimidation",
    description: "Pure psychological pressure. +15% strikeout chance and -5% walk chance directly, regardless of stats.",
    flavorText: "Pure psychological warfare.",
    spiritCost: 18,
    slotCost: 1,
    requiredClass: "Flamethrower",
    requiredLevel: 7,
    path: "Power Path",
    tags: ["psychological", "strikeout"],
    conflictsWith: ["setup_pitch"],
    effects: [
      {
        type: "outcome_modifier",
        strikeoutBonus: 15,
        walkBonus: -5,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "😤",
  },
  {
    id: "setup_pitch",
    name: "Setup Pitch",
    description: "Set them up with a breaking ball. +20 break and +10 control for more Ks and fewer walks, plus +5% strikeout bonus.",
    flavorText: "The setup makes the fastball even faster.",
    spiritCost: 14,
    slotCost: 1,
    requiredClass: "Flamethrower",
    requiredLevel: 7,
    path: "Tactical Path",
    tags: ["tactical", "strikeout"],
    conflictsWith: ["intimidation"],
    effects: [
      {
        type: "stat_modifier",
        break: 20,
        control: 10,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: 5,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎯",
  },
  {
    id: "untouchable",
    name: "Untouchable",
    description: "Enter a flow state. Bypasses normal pitching — 65% strikeout, 25% weak contact out, 10% walk. No hits allowed.",
    flavorText: "Nobody's getting a hit off this pitch.",
    spiritCost: 28,
    slotCost: 2,
    requiredClass: "Flamethrower",
    requiredLevel: 10,
    prerequisiteAbilityId: "heat_up",
    path: "Power Path",
    tags: ["power", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "strikeout",
        successChance: 65,
        outcomes: [
          { result: "strikeout", chance: 65 },
          { result: "out", chance: 25 },
          { result: "walk", chance: 10 },
        ],
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "⚡",
  },
  {
    id: "iron_arm",
    name: "Iron Arm",
    description: "Passive. +10 velocity all game. Completely negates pitcher fatigue — your stats don't decay over innings.",
    flavorText: "Stamina like no one else.",
    spiritCost: 0,
    slotCost: 1,
    requiredClass: "Flamethrower",
    requiredLevel: 12,
    isPassive: true,
    path: "Durability Path",
    tags: ["passive", "durability"],
    effects: [
      {
        type: "stat_modifier",
        velocity: 10,
        negateFatigue: true,
        duration: "game",
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "💪",
  },
  {
    id: "inferno",
    name: "Inferno",
    description: "Maximum velocity. +50 velocity with +25% strikeout chance, but +8% walk chance from reduced control. High risk, high reward.",
    flavorText: "Maximum effort. Maximum risk.",
    spiritCost: 35,
    slotCost: 2,
    requiredClass: "Flamethrower",
    requiredLevel: 15,
    path: "Power Path",
    tags: ["ultimate", "risky"],
    effects: [
      {
        type: "stat_modifier",
        velocity: 50,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: 25,
        walkBonus: 8,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🌋",
  },
];

// ============================================
// PAINTER TECHNIQUES (Control/Precision Pitcher)
// ============================================

export const PAINTER_TECHNIQUES: Technique[] = [
  {
    id: "pinpoint",
    name: "Pinpoint",
    description: "Paint the corners. Bypasses normal pitching — 55% weak contact out, 35% strikeout, 10% single. No free passes.",
    flavorText: "On the corner. On the edge. Just out of reach.",
    spiritCost: 12,
    slotCost: 1,
    requiredClass: "Painter",
    requiredLevel: 5,
    path: "Core",
    tags: ["control", "precision", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "out",
        successChance: 55,
        outcomes: [
          { result: "out", chance: 55 },
          { result: "strikeout", chance: 35 },
          { result: "single", chance: 10 },
        ],
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎨",
    synergyEnhancement: {
      requiredSynergy: "mastermind",
      bonusEffects: [{ type: "outcome_modifier", homerunBonus: -5 }],
      enhancedDescription: "-5% home run chance with Mastermind",
    },
  },
  {
    id: "pitch_to_contact_painter",
    name: "Pitch to Contact",
    description: "Trust your defense. +10 control and +15 team defense rating. Balls in play become outs more often.",
    flavorText: "Let the defense do the work.",
    spiritCost: 14,
    slotCost: 1,
    requiredClass: "Painter",
    requiredLevel: 7,
    path: "Defense Path",
    tags: ["defense", "contact"],
    conflictsWith: ["nibbler"],
    effects: [
      {
        type: "stat_modifier",
        control: 10,
        duration: "at_bat",
      },
      {
        type: "defensive_boost",
        gloveBonus: 15,
        duration: "at_bat",
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🤝",
  },
  {
    id: "nibbler",
    name: "Nibbler",
    description: "Work the edges. +20 control with -8% home run chance, but accept +12% walk chance. Trade free bases for zero damage.",
    flavorText: "They'll never get a good pitch to hit.",
    spiritCost: 16,
    slotCost: 1,
    requiredClass: "Painter",
    requiredLevel: 7,
    path: "Control Path",
    tags: ["control", "strategic"],
    conflictsWith: ["pitch_to_contact_painter"],
    effects: [
      {
        type: "stat_modifier",
        control: 20,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        walkBonus: 12,
        homerunBonus: -8,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎯",
  },
  {
    id: "surgeons_precision",
    name: "Surgeon's Precision",
    description: "Total command. +30 control and +20 break with -10% home run chance. Tradeoff: -8% strikeout chance (more balls in play, but weak contact).",
    flavorText: "No walks. No homers. Just weak contact, all day.",
    spiritCost: 25,
    slotCost: 2,
    requiredClass: "Painter",
    requiredLevel: 10,
    prerequisiteAbilityId: "pinpoint",
    path: "Control Path",
    tags: ["power", "control"],
    effects: [
      {
        type: "stat_modifier",
        control: 30,
        break: 20,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        homerunBonus: -10,
        strikeoutBonus: -8,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🔬",
  },
  {
    id: "economizer",
    name: "Economizer",
    description: "Passive. +5 control all game. All active techniques cost 20% less spirit. Available to any archetype.",
    flavorText: "Every pitch counts. Every ounce of energy matters.",
    spiritCost: 0,
    slotCost: 1,
    requiredClass: "Painter",
    requiredLevel: 12,
    isPassive: true,
    allowCrossArchetype: true,
    path: "Efficiency Path",
    tags: ["passive", "efficiency", "cross-archetype"],
    effects: [
      {
        type: "stat_modifier",
        control: 5,
        duration: "game",
      },
      // Note: 20% spirit cost reduction is handled in abilitySystem.ts
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "⚙️",
  },
  {
    id: "masterclass",
    name: "Masterclass",
    description: "Dominate the entire inning. +40 control and +25 break for all at-bats this inning, with -15% home run chance. Total command.",
    flavorText: "This is what mastery looks like.",
    spiritCost: 30,
    slotCost: 2,
    requiredClass: "Painter",
    requiredLevel: 15,
    path: "Control Path",
    tags: ["ultimate", "inning-duration"],
    effects: [
      {
        type: "stat_modifier",
        control: 40,
        break: 25,
        duration: "inning",
      },
      {
        type: "outcome_modifier",
        homerunBonus: -15,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "👨‍🏫",
  },
];

// ============================================
// TRICKSTER TECHNIQUES (Deception/Breaking Ball Pitcher)
// ============================================

export const TRICKSTER_TECHNIQUES: Technique[] = [
  {
    id: "vanishing_act",
    name: "Vanishing Act",
    description: "The ball drops off the table. Bypasses normal pitching — 60% strikeout, 20% walk, 20% weak contact out.",
    flavorText: "Now you see it, now you don't.",
    spiritCost: 13,
    slotCost: 1,
    requiredClass: "Trickster",
    requiredLevel: 5,
    path: "Core",
    tags: ["deception", "break", "guaranteed"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "strikeout",
        successChance: 60,
        outcomes: [
          { result: "strikeout", chance: 60 },
          { result: "walk", chance: 20 },
          { result: "out", chance: 20 },
        ],
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🌀",
    synergyEnhancement: {
      requiredSynergy: "mind_games",
      bonusEffects: [{ type: "outcome_modifier", strikeoutBonus: 5 }],
      enhancedDescription: "+5% strikeout chance with Mind Games",
    },
  },
  {
    id: "changeup_trickster",
    name: "Changeup",
    description: "Destroy their timing. +15 break and +10 control with +10% strikeout chance and -5% walk chance. All upside, no tradeoff.",
    flavorText: "They're out in front by a mile.",
    spiritCost: 15,
    slotCost: 1,
    requiredClass: "Trickster",
    requiredLevel: 7,
    path: "Control Deception Path",
    tags: ["deception", "strikeout"],
    conflictsWith: ["knuckleball"],
    effects: [
      {
        type: "stat_modifier",
        break: 15,
        control: 10,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: 10,
        walkBonus: -5,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🐌",
  },
  {
    id: "knuckleball",
    name: "Knuckleball",
    description: "Pure chaos. Bypasses normal pitching — 60% strikeout, 40% walk. Nobody knows where it's going, not even you.",
    flavorText: "Chaos incarnate.",
    spiritCost: 16,
    slotCost: 1,
    requiredClass: "Trickster",
    requiredLevel: 7,
    path: "Chaos Path",
    tags: ["chaos", "guaranteed"],
    conflictsWith: ["changeup_trickster"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "strikeout",
        successChance: 60,
      },
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎲",
  },
  {
    id: "phantom_pitch",
    name: "Phantom Pitch",
    description: "Impossible movement with velocity. +25 break and +15 velocity with +15% strikeout chance. Risk: +5% walk chance from wild movement.",
    flavorText: "Movement like they've never seen.",
    spiritCost: 26,
    slotCost: 2,
    requiredClass: "Trickster",
    requiredLevel: 10,
    prerequisiteAbilityId: "vanishing_act",
    path: "Deception Path",
    tags: ["power", "deception"],
    effects: [
      {
        type: "stat_modifier",
        break: 25,
        velocity: 15,
        duration: "at_bat",
      },
      {
        type: "outcome_modifier",
        strikeoutBonus: 15,
        walkBonus: 5,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "👻",
  },
  {
    id: "repertoire",
    name: "Repertoire",
    description: "Passive. +15 break all game. But using the same technique twice in a row incurs -10 break. Rewards variety.",
    flavorText: "Keep them guessing. Always.",
    spiritCost: 0,
    slotCost: 1,
    requiredClass: "Trickster",
    requiredLevel: 12,
    isPassive: true,
    path: "Variety Path",
    tags: ["passive", "strategic"],
    effects: [
      {
        type: "stat_modifier",
        break: 15,
        duration: "game",
      },
      // Note: Consecutive use penalty is handled in match engine
    ],
    maxRank: 3,
    currentRank: 1,
    iconEmoji: "🎭",
  },
  {
    id: "total_eclipse",
    name: "Total Eclipse",
    description: "The ultimate pitch. Bypasses normal pitching — 80% strikeout, 15% walk, 5% single. Almost unhittable.",
    flavorText: "They'll never forget this pitch.",
    spiritCost: 32,
    slotCost: 2,
    requiredClass: "Trickster",
    requiredLevel: 15,
    path: "Chaos Path",
    tags: ["ultimate", "guaranteed", "chaos"],
    effects: [
      {
        type: "guaranteed_outcome",
        outcome: "strikeout",
        successChance: 80,
      },
    ],
    maxRank: 2,
    currentRank: 1,
    iconEmoji: "🌑",
  },
];

// ============================================
// TECHNIQUE REGISTRY
// ============================================

/**
 * All techniques organized by archetype
 */
export const TECHNIQUES_BY_ARCHETYPE = {
  Slugger: SLUGGER_TECHNIQUES,
  "Contact Hitter": CONTACT_HITTER_TECHNIQUES,
  "Speed Demon": SPEED_DEMON_TECHNIQUES,
  Flamethrower: FLAMETHROWER_TECHNIQUES,
  Painter: PAINTER_TECHNIQUES,
  Trickster: TRICKSTER_TECHNIQUES,
};

/**
 * Flat list of all techniques
 */
export const ALL_TECHNIQUES: Technique[] = [
  ...SLUGGER_TECHNIQUES,
  ...CONTACT_HITTER_TECHNIQUES,
  ...SPEED_DEMON_TECHNIQUES,
  ...FLAMETHROWER_TECHNIQUES,
  ...PAINTER_TECHNIQUES,
  ...TRICKSTER_TECHNIQUES,
];

/**
 * Get technique by ID
 */
export function getTechniqueById(id: string): Technique | undefined {
  return ALL_TECHNIQUES.find((tech) => tech.id === id);
}

/**
 * Get all techniques for an archetype
 */
export function getTechniquesForArchetype(
  archetype: string
): Technique[] {
  return TECHNIQUES_BY_ARCHETYPE[archetype as keyof typeof TECHNIQUES_BY_ARCHETYPE] || [];
}

/**
 * Get starter technique ID for an archetype
 */
export function getStarterTechniqueId(archetype: string): string {
  const starters: Record<string, string> = {
    Slugger: "moonshot",
    "Contact Hitter": "two_strike_assassin",
    "Speed Demon": "crazy_bunt",
    Flamethrower: "heat_up",
    Painter: "pinpoint",
    Trickster: "vanishing_act",
  };
  return starters[archetype] || "power_swing";
}
