/**
 * Breakthrough Moment System
 * Detects and triggers skill rank advances at pivotal moments
 */

import type {
  BreakthroughEvent,
  SignatureSkill,
} from "@/types/breakthroughs";
import type { Player } from "@/types/game";
import type { MentalSkill } from "@/types/mentalSkills";
import type { RandomProvider } from "./randomProvider";

/**
 * Game context needed for breakthrough detection and narrative generation
 */
export interface BreakthroughContext {
  gameNumber: number;
  inning: number;
  outs: number;
  runners: boolean[]; // [1st, 2nd, 3rd]
  score: {
    myRuns: number;
    opponentRuns: number;
  };
  isHighLeverage: boolean;
  opponentName: string;
  rng: RandomProvider;
}

/**
 * Check if a breakthrough should trigger for a player's skill
 * Returns BreakthroughEvent if triggered, null otherwise
 */
export function checkBreakthroughTrigger(
  player: Player,
  gameContext: BreakthroughContext,
  skillId: string,
  skill: MentalSkill
): BreakthroughEvent | null {
  // Validate trigger conditions
  if (!canBreakthroughTrigger(player, gameContext, skill, skillId)) {
    return null;
  }

  // Calculate trigger probability
  const triggerProb = calculateBreakthroughProbability(player, gameContext);
  if (gameContext.rng.random() > triggerProb) {
    return null;
  }

  // Determine archetype
  const archetype = determineBreakthroughArchetype(skill, gameContext);

  // Generate narrative and memory label
  const narrative = generateBreakthroughNarrative(player, skillId, archetype);
  const memoryLabel = generateMemoryLabel(player, skillId, gameContext);

  // Check if signature skill should be generated (Rank 4→5)
  let signatureSkillId: string | undefined;
  if (skill.rank === 4 && !hasActiveBadHabit(player)) {
    signatureSkillId = `sig-${player.id}-${skillId}-${Date.now()}`;
  }

  const event: BreakthroughEvent = {
    breakthroughId: `bt-${player.id}-${skillId}-${Date.now()}`,
    playerId: player.id,
    skillId,
    skillRank: skill.rank + 1,
    archetype,
    triggeredAt: {
      gameNumber: gameContext.gameNumber,
      inning: gameContext.inning,
      scoreDiff: gameContext.score.myRuns - gameContext.score.opponentRuns,
      context: buildGameContext(gameContext),
    },
    narrative,
    mentorNarrative: undefined, // TODO: add mentor logic
    signatureSkillId,
    memoryLabel,
    createdAt: new Date(),
  };

  return event;
}

/**
 * Validate all preconditions for breakthrough
 */
function canBreakthroughTrigger(
  player: Player,
  gameContext: BreakthroughContext,
  skill: MentalSkill,
  skillId: string
): boolean {
  // Must be 80%+ toward next rank
  const xpToNextRank = getXpToNextRank(skill.rank);
  const xpPercent = (skill.xp / xpToNextRank) * 100;
  if (xpPercent < 80) {
    return false;
  }

  // Must be high-leverage
  if (!gameContext.isHighLeverage) {
    return false;
  }

  // Max 1 breakthrough per season
  if (hasBreakthroughThisSeason(player, skillId)) {
    return false;
  }

  // Rank must be 1-4 (can't advance past 5)
  if (skill.rank >= 5) {
    return false;
  }

  return true;
}

/**
 * Calculate probability of breakthrough (35% base + modifiers)
 */
function calculateBreakthroughProbability(
  player: Player,
  _gameContext: BreakthroughContext
): number {
  let p = 0.35; // Base probability

  // Trait bonuses
  if (player.traits?.some((t) => t === "Grit")) {
    p += 0.1;
  }
  if (player.traits?.some((t) => t === "Flash")) {
    p += 0.15;
  }

  // Bad habit penalty
  if (hasActiveBadHabit(player)) {
    p -= 0.15;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, p));
}

/**
 * Determine breakthrough archetype based on game context and player profile
 */
function determineBreakthroughArchetype(
  skill: MentalSkill,
  gameContext: BreakthroughContext
): "contrast_moment" | "streak_moment" | "comeback_moment" | "specialization_moment" {
  const scoreDiff = gameContext.score.myRuns - gameContext.score.opponentRuns;

  // Comeback: down significantly, scores anyway
  if (scoreDiff < -2) {
    return "comeback_moment";
  }

  // Streak: consistent behavior in high-leverage
  if (skill.confidence > 80) {
    return "streak_moment";
  }

  // Contrast: doing something unexpected (late inning, 2 outs)
  if (gameContext.outs === 2 && gameContext.inning >= 8) {
    return "contrast_moment";
  }

  // Specialization: vs specific opponent
  return "specialization_moment";
}

/**
 * Generate breakthrough narrative
 */
function generateBreakthroughNarrative(
  player: Player,
  skillId: string,
  archetype: "contrast_moment" | "streak_moment" | "comeback_moment" | "specialization_moment"
): string {
  const skillNames: Record<string, string> = {
    ice_veins: "Ice Veins",
    pitch_recognition: "Pitch Recognition",
    clutch_composure: "Clutch Composure",
    veteran_poise: "Veteran's Poise",
    game_reading: "Game Reading",
  };

  const skillName = skillNames[skillId] || skillId;

  const narratives: Record<string, string[]> = {
    contrast_moment: [
      `${player.name} did something unexpected. ${skillName} clicked. And it worked.`,
      `For the first time this season, ${player.name} broke their own pattern. The result was perfect.`,
      `${player.name} understood something new about ${skillName} today.`,
    ],
    streak_moment: [
      `${player.name}'s ${skillName} finally paid dividends.`,
      `Repetition became mastery. ${player.name} was ready.`,
      `${player.name} had done this a thousand times. The thousand-and-first was different.`,
    ],
    comeback_moment: [
      `${player.name} refused to quit. The game rewarded that refusal.`,
      `Back against the wall, ${player.name} found something extra.`,
      `Redemption. ${player.name} understood ${skillName} now.`,
    ],
    specialization_moment: [
      `${player.name} cracked the code.`,
      `Years of repetition paid off. ${player.name}'s ${skillName} was complete.`,
      `${player.name} saw something no one else could.`,
    ],
  };

  const pool = narratives[archetype] || narratives["specialization_moment"];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate memory label for the breakthrough event
 */
function generateMemoryLabel(
  player: Player,
  skillId: string,
  gameContext: BreakthroughContext
): string {
  const skillNames: Record<string, string> = {
    ice_veins: "Ice Veins",
    pitch_recognition: "Recognition",
    clutch_composure: "Composure",
    veteran_poise: "Poise",
    game_reading: "Insight",
  };

  const skillShort = skillNames[skillId] || skillId;
  const context = buildGameContext(gameContext);

  return `${player.name}'s ${skillShort} (Game ${gameContext.gameNumber}, ${context})`;
}

/**
 * Check if player already had breakthrough this season
 */
function hasBreakthroughThisSeason(player: Player, skillId: string): boolean {
  if (!player.breakthroughEvents) {
    return false;
  }
  // In real system, would track season number
  // For now, just check if any breakthrough exists for this skill
  return player.breakthroughEvents.some((e) => e.skillId === skillId);
}

/**
 * Check if player has active bad habit
 */
function hasActiveBadHabit(_player: Player): boolean {
  // Placeholder: in real system, check player.badHabits array
  return false;
}

/**
 * Build contextual description for game state
 */
function buildGameContext(gameContext: BreakthroughContext): string {
  const scoreDiff = gameContext.score.myRuns - gameContext.score.opponentRuns;
  const runners = gameContext.runners[0] || gameContext.runners[1] || gameContext.runners[2];

  if (gameContext.inning >= 9 && scoreDiff === 0) {
    return "tied, 9th+";
  }
  if (runners && gameContext.outs === 2) {
    return "two outs, bases loaded";
  }
  if (gameContext.inning >= 8) {
    return `inning ${gameContext.inning}`;
  }

  return "key moment";
}

/**
 * Get XP required for next rank
 */
function getXpToNextRank(currentRank: number): number {
  const thresholds = [40, 60, 100, 160, 240];
  return thresholds[Math.min(currentRank, 4)];
}

/**
 * Activate breakthrough: rank advance and signature skill generation
 */
export function activateBreakthrough(
  player: Player,
  breakthrough: BreakthroughEvent
): void {
  // Find the skill
  if (!player.mentalSkills) {
    player.mentalSkills = [];
  }

  const skill = player.mentalSkills.find((s) => s.skillId === breakthrough.skillId);
  if (!skill) {
    return;
  }

  // Advance rank
  skill.rank = breakthrough.skillRank as import("@/types/mentalSkills").MentalSkillRank;
  skill.xp = 0; // Reset XP for new rank
  skill.confidence = Math.min(100, skill.confidence + 20); // Confidence boost

  // Log breakthrough event
  if (!player.breakthroughEvents) {
    player.breakthroughEvents = [];
  }
  player.breakthroughEvents.push(breakthrough);

  // Generate signature skill if applicable
  if (breakthrough.signatureSkillId && breakthrough.skillRank === 5) {
    generateSignatureSkill(player, breakthrough);
  }
}

/**
 * Generate signature skill from breakthrough
 */
function generateSignatureSkill(
  player: Player,
  breakthrough: BreakthroughEvent
): void {
  if (!breakthrough.signatureSkillId) {
    return;
  }

  const skillNames: Record<string, string> = {
    ice_veins: "Ice Veins",
    pitch_recognition: "Pitch Recognition",
    clutch_composure: "Clutch Composure",
    veteran_poise: "Veteran's Poise",
    game_reading: "Game Reading",
  };

  const signature: SignatureSkill = {
    signatureId: breakthrough.signatureSkillId,
    skillId: breakthrough.skillId,
    playerId: player.id,
    skillName: `${skillNames[breakthrough.skillId] || breakthrough.skillId}`,
    effectBonus: 0.1, // 10% above Rank 5
    unlockedAt: breakthrough,
    isActive: true,
    reputation: {
      knownBy: [],
      counterStrategies: [],
      scoutLevel: 0,
    },
  };

  if (!player.signatureSkills) {
    player.signatureSkills = new Map();
  }

  player.signatureSkills.set(breakthrough.signatureSkillId, signature);
}
