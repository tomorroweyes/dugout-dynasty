/**
 * Coaching Voices System
 *
 * In high-leverage moments (inning 7+, close game), active mental skills
 * "speak" through the play-by-play as internal voices. If the player has a
 * mentor (present or retired), a mentor voice line appears as well.
 *
 * Trigger: 2+ mental skills at Rank 3+, high-leverage moment.
 * Max 3 voices shown per AB (most contextually relevant).
 *
 * See GitHub issue #37.
 */

import type { Player } from "@/types/game";
import type { VoiceLine, VoiceDebate } from "@/types/mentorship";
import type { MentalSkillType } from "@/types/mentalSkills";
import {
  COACHING_VOICE_ICE_VEINS,
  COACHING_VOICE_PITCH_RECOGNITION,
  COACHING_VOICE_CLUTCH_COMPOSURE,
  COACHING_VOICE_VETERAN_POISE,
  COACHING_VOICE_GAME_READING,
} from "./narrative/situationalPools";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum inning for coaching voices to trigger */
export const COACHING_VOICE_MIN_INNING = 7;

/** Minimum number of qualifying skills (Rank 3+) to trigger voices */
export const COACHING_VOICE_MIN_SKILLS = 2;

/** Minimum rank for a skill to contribute a voice */
export const COACHING_VOICE_MIN_RANK = 3;

/** Max number of voices shown per AB */
export const COACHING_VOICE_MAX_SHOWN = 3;

// ---------------------------------------------------------------------------
// Voice Templates
// ---------------------------------------------------------------------------

const VOICE_TEMPLATES: Record<MentalSkillType, string> = {
  ice_veins:         COACHING_VOICE_ICE_VEINS,
  pitch_recognition: COACHING_VOICE_PITCH_RECOGNITION,
  clutch_composure:  COACHING_VOICE_CLUTCH_COMPOSURE,
  veteran_poise:     COACHING_VOICE_VETERAN_POISE,
  game_reading:      COACHING_VOICE_GAME_READING,
};

// ---------------------------------------------------------------------------
// Game Context
// ---------------------------------------------------------------------------

/**
 * Context passed to the coaching voices system for each AB.
 */
export interface CoachingVoicesContext {
  /** Current inning (1-indexed) */
  inning: number;
  /** Absolute score difference (|my - opponent|) */
  scoreDiffAbs: number;
  /** True if the game is currently close (score diff ≤ 2) */
  isCloseGame: boolean;
  /** True if mentor is in the active lineup for this game */
  mentorInLineup: boolean;
  /** Name of the mentor (if any) */
  mentorName?: string;
  /** True if player has a mentor (even a retired one — for legacy voice) */
  hasMentorLegacy: boolean;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Select and return the Coaching Voices debate for this at-bat.
 *
 * Returns null if conditions are not met (inning < 7, not close, < 2 qualifying skills).
 *
 * @param player  - The player at the plate
 * @param context - Game context for this AB
 */
export function selectActiveVoices(
  player: Player,
  context: CoachingVoicesContext
): VoiceDebate | null {
  // Must be high-leverage
  if (!isHighLeverage(context)) {
    return null;
  }

  // Collect qualifying skills (Rank 3+)
  const qualifyingSkills = (player.mentalSkills ?? []).filter(
    (s) => s.rank >= COACHING_VOICE_MIN_RANK && s.isActive
  );

  if (qualifyingSkills.length < COACHING_VOICE_MIN_SKILLS) {
    return null;
  }

  // Build voice lines — prioritize by rank descending, then pick top MAX_SHOWN
  const sortedSkills = [...qualifyingSkills].sort((a, b) => b.rank - a.rank);
  const selectedSkills = sortedSkills.slice(0, COACHING_VOICE_MAX_SHOWN);

  const voices: VoiceLine[] = selectedSkills.map((skill) => ({
    skillId: skill.skillId,
    text: VOICE_TEMPLATES[skill.skillId] ?? "Trust your instincts.",
    isMentorVoice: false,
  }));

  // Mentor voice: appears as an extra line if mentor is in lineup or retired
  let mentorVoice: VoiceLine | undefined;
  if (context.hasMentorLegacy || context.mentorInLineup) {
    const mentorSkill = selectedSkills[0]; // Mentor echoes the top-rank skill
    if (mentorSkill && context.mentorName) {
      mentorVoice = {
        skillId: mentorSkill.skillId,
        text: VOICE_TEMPLATES[mentorSkill.skillId] ?? "Trust the work.",
        isMentorVoice: true,
        mentorName: context.mentorName,
      };
    }
  }

  return { voices, mentorVoice };
}

/**
 * Format a VoiceDebate as play-by-play text (internal monologue style).
 *
 * @param debate  - The voice debate to format
 * @returns Multi-line string for play-by-play insertion
 */
export function formatVoiceDebate(debate: VoiceDebate): string {
  const lines: string[] = [];

  for (const voice of debate.voices) {
    lines.push(`  💭 ${voice.text}`);
  }

  if (debate.mentorVoice) {
    lines.push(`  🎙️ [${debate.mentorVoice.mentorName ?? "Mentor"} once said:] ${debate.mentorVoice.text}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a game context qualifies as high-leverage for coaching voices.
 */
export function isHighLeverage(context: CoachingVoicesContext): boolean {
  return context.inning >= COACHING_VOICE_MIN_INNING && context.isCloseGame;
}
