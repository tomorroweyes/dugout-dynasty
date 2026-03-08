/**
 * Mentorship System Types — Phase 5
 *
 * Asymmetric XP exchange, style transfer, legacy lineage, and Coaching Voices.
 * A veteran player mentors a younger player for 1 season (renewable).
 *
 * See GitHub issues #35, #36, #37.
 */

import type { MentalSkillType } from "./mentalSkills";

// ---------------------------------------------------------------------------
// Mentorship Pair
// ---------------------------------------------------------------------------

export interface StyleTransfer {
  /** Positive transfers accelerate skill discovery; negative seeds a bad habit */
  type: "positive" | "negative";
  /** Human-readable description shown on player card */
  description: string;
  /** Machine-readable effect for the engine */
  mechanicEffect: string;
  /** Magnitude of the effect (e.g., 0.05 = 5% discovery bonus) */
  magnitude: number;
}

export interface MentorshipPair {
  pairId: string;
  mentorId: string;
  apprenticeId: string;
  /** Season this pair was originally formed */
  season: number;
  /** Style transfers resolved at pair creation */
  styleTransfers: StyleTransfer[];
  isActive: boolean;
  /** Additional seasons this pair was renewed (off-season renewals) */
  renewedSeasons: number[];
}

// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

export interface LineageNode {
  playerId: string;
  playerName: string;
  /** Signature skill held by this node at time of mentoring */
  signatureSkillId?: string;
  signatureSkillName?: string;
  /** 0 = self, 1 = direct mentor, 2 = mentor's mentor, 3 = great-mentor */
  generation: number;
}

// ---------------------------------------------------------------------------
// Coaching Voices
// ---------------------------------------------------------------------------

export interface VoiceLine {
  skillId: MentalSkillType;
  text: string;
  /** True when this line comes from a mentor (past or present) */
  isMentorVoice: boolean;
  /** Mentor name prefix, e.g. "[Rivera] once said:" */
  mentorName?: string;
}

export interface VoiceDebate {
  voices: VoiceLine[];
  mentorVoice?: VoiceLine;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum age gap (in years) for mentor eligibility */
export const MENTORSHIP_MIN_AGE_GAP = 5;

/** XP penalty for mentor when in same game as apprentice */
export const MENTOR_XP_MULTIPLIER = 0.80; // −20%

/** XP bonus for apprentice when in same game as mentor */
export const APPRENTICE_XP_MULTIPLIER = 1.40; // +40%

/** Probability that a style transfer is positive (vs negative) */
export const STYLE_TRANSFER_POSITIVE_CHANCE = 0.70;

/** Number of style transfers resolved at pair creation */
export const STYLE_TRANSFER_COUNT = 3;

/** Strength a seeded bad habit starts at when transferred from mentor */
export const SEEDED_HABIT_STRENGTH = 5;

/** Legacy bonus per generation chain depth */
export const LEGACY_BONUS_PER_GENERATION = 0.05; // +5% per gen
export const LEGACY_BONUS_CAP = 0.20;            // max +20%
