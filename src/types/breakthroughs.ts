/**
 * Breakthrough Moment System — Narrative-driven skill advances at pivotal moments
 */

export type BreakthroughArchetype =
  | "contrast_moment"      // Player does opposite of identity, succeeds
  | "streak_moment"        // Consistent behavior pays off at right time
  | "comeback_moment"      // Redemption after slump
  | "specialization_moment"; // Player cracks code on specific opponent/context

export interface BreakthroughTriggeredAt {
  gameNumber: number;
  inning: number;
  scoreDiff: number;
  context: string; // "bases loaded, 9th inning", "vs ace closer", etc.
}

export interface BreakthroughEvent {
  breakthroughId: string;
  playerId: string;
  skillId: string;
  skillRank: number; // rank achieved (2-5, since rank 1 requires Tier 1 discovery)
  archetype: BreakthroughArchetype;
  triggeredAt: BreakthroughTriggeredAt;
  narrative: string; // "Something clicked for [Name] today..."
  mentorNarrative?: string; // "[Mentor] watched from the dugout. Smiled. Didn't say a word."
  signatureSkillId?: string; // if Rank 4→5 with no bad habit
  memoryLabel: string; // "Rivera's Hammer (walk-off vs Steel City Rollers, S3G12)"
  createdAt: Date;
}

export interface SignatureSkillReputation {
  knownBy: string[]; // team names that have seen this skill
  counterStrategies: string[]; // ["Pitch outside", "Shift left", etc.]
  scoutLevel: 0 | 1 | 2 | 3; // 0=unknown, 1=seen once, 2=pattern detected, 3=fully mapped
}

export interface SignatureSkill {
  signatureId: string;
  skillId: string;
  playerId: string;
  skillName: string; // e.g., "Rivera's Hammer"
  effectBonus: number; // +0.10 (10% above Rank 5 effectiveness)
  unlockedAt: BreakthroughEvent;
  isActive: boolean;
  reputation: SignatureSkillReputation;
}

/**
 * Breakthrough trigger conditions and RNG formula
 */
export const BREAKTHROUGH_TRIGGER_CONDITIONS = {
  xpThresholdPercent: 80, // Must be 80%+ toward next rank
  highLeverageRequired: true, // Inning 7+, close game, or clutch context
  maxPerSeason: 1, // Only 1 breakthrough per season per player
  baseProbability: 0.35, // 35% base RNG

  // Trait modifiers
  traitBonuses: {
    grit: 0.10,      // +10%
    flash: 0.15,     // +15%
    mentorPresent: 0.10, // +10%
  },

  // Penalty
  badHabitPenalty: 0.15, // -15%
};

/**
 * Signature skill generation (Rank 4→5 without active bad habit)
 */
export const SIGNATURE_SKILL_GENERATION = {
  rankRequired: 5, // Only for rank 5 advances
  badHabitBlocksSignature: true, // Can't unlock if bad habit is active
  effectBonusPercent: 10, // +10% above Rank 5
  reputationStartLevel: 0, // Starts unknown to opponents
};
