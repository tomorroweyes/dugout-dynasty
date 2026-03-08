/**
 * Tests for coachingVoices.ts — Issue #37
 */

import { describe, it, expect } from "vitest";
import type { Player } from "@/types/game";
import type { MentalSkill } from "@/types/mentalSkills";
import {
  selectActiveVoices,
  formatVoiceDebate,
  isHighLeverage,
  COACHING_VOICE_MIN_INNING,
  COACHING_VOICE_MIN_SKILLS,
  COACHING_VOICE_MIN_RANK,
  COACHING_VOICE_MAX_SHOWN,
} from "@/engine/coachingVoices";
import type { CoachingVoicesContext } from "@/engine/coachingVoices";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p-cv-001",
    name: "Rivera",
    surname: "Rivera",
    role: "Batter",
    stats: { power: 70, contact: 75, glove: 60, speed: 65 },
    salary: 5000,
    level: 6,
    xp: 600,
    totalXpEarned: 3000,
    equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    spirit: { current: 80, max: 100 },
    abilities: [],
    skillPoints: 0,
    traits: [],
    ...overrides,
  };
}

function makeSkill(
  skillId: MentalSkill["skillId"],
  rank: number = 3,
  active = true
): MentalSkill {
  return {
    skillId,
    rank: rank as MentalSkill["rank"],
    xp: 50,
    xpToNextRank: 100,
    confidence: 75,
    lastTriggeredGame: 0,
    isActive: active,
    decayRate: 5,
    wasLapsed: false,
  };
}

function makeHighLeverageContext(overrides: Partial<CoachingVoicesContext> = {}): CoachingVoicesContext {
  return {
    inning: 8,
    scoreDiffAbs: 1,
    isCloseGame: true,
    mentorInLineup: false,
    hasMentorLegacy: false,
    ...overrides,
  };
}

function makeLowLeverageContext(): CoachingVoicesContext {
  return {
    inning: 3,
    scoreDiffAbs: 5,
    isCloseGame: false,
    mentorInLineup: false,
    hasMentorLegacy: false,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Coaching Voice constants", () => {
  it("minimum inning is 7", () => {
    expect(COACHING_VOICE_MIN_INNING).toBe(7);
  });

  it("minimum qualifying skills is 2", () => {
    expect(COACHING_VOICE_MIN_SKILLS).toBe(2);
  });

  it("minimum rank to qualify is 3", () => {
    expect(COACHING_VOICE_MIN_RANK).toBe(3);
  });

  it("max voices shown is 3", () => {
    expect(COACHING_VOICE_MAX_SHOWN).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isHighLeverage
// ---------------------------------------------------------------------------

describe("isHighLeverage", () => {
  it("returns true for inning 7+ and close game", () => {
    expect(isHighLeverage({ inning: 7, isCloseGame: true, scoreDiffAbs: 1, mentorInLineup: false, hasMentorLegacy: false })).toBe(true);
  });

  it("returns true for inning 9", () => {
    expect(isHighLeverage({ inning: 9, isCloseGame: true, scoreDiffAbs: 0, mentorInLineup: false, hasMentorLegacy: false })).toBe(true);
  });

  it("returns false for inning 6 (below threshold)", () => {
    expect(isHighLeverage({ inning: 6, isCloseGame: true, scoreDiffAbs: 1, mentorInLineup: false, hasMentorLegacy: false })).toBe(false);
  });

  it("returns false when game is not close", () => {
    expect(isHighLeverage({ inning: 8, isCloseGame: false, scoreDiffAbs: 8, mentorInLineup: false, hasMentorLegacy: false })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectActiveVoices
// ---------------------------------------------------------------------------

describe("selectActiveVoices", () => {
  it("returns null in low-leverage context", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    expect(selectActiveVoices(player, makeLowLeverageContext())).toBeNull();
  });

  it("returns null when fewer than 2 qualifying skills", () => {
    const player = makePlayer({
      mentalSkills: [makeSkill("ice_veins", 4)], // only 1 qualifying
    });
    expect(selectActiveVoices(player, makeHighLeverageContext())).toBeNull();
  });

  it("returns null when qualifying skills are below Rank 3", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 2),     // too low
        makeSkill("clutch_composure", 2), // too low
      ],
    });
    expect(selectActiveVoices(player, makeHighLeverageContext())).toBeNull();
  });

  it("returns VoiceDebate when 2+ qualifying skills in high leverage", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    expect(debate).toBeTruthy();
    expect(debate!.voices.length).toBeGreaterThanOrEqual(COACHING_VOICE_MIN_SKILLS);
  });

  it("returns at most COACHING_VOICE_MAX_SHOWN voices", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 5),
        makeSkill("clutch_composure", 4),
        makeSkill("pitch_recognition", 3),
        makeSkill("veteran_poise", 3),
        makeSkill("game_reading", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    expect(debate!.voices.length).toBeLessThanOrEqual(COACHING_VOICE_MAX_SHOWN);
  });

  it("does not include inactive skills", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4, true),
        makeSkill("clutch_composure", 3, false), // inactive
        makeSkill("veteran_poise", 3, true),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    // Should only have ice_veins + veteran_poise
    const inactiveVoice = debate?.voices.find((v) => v.skillId === "clutch_composure");
    expect(inactiveVoice).toBeUndefined();
  });

  it("voices are sorted by rank (highest first)", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 3),
        makeSkill("clutch_composure", 5),
        makeSkill("veteran_poise", 4),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    expect(debate!.voices[0].skillId).toBe("clutch_composure"); // rank 5 first
  });

  it("each voice has a non-empty text", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    for (const voice of debate!.voices) {
      expect(voice.text.length).toBeGreaterThan(0);
    }
  });

  it("mentor voice appears when mentor in lineup", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext({
      mentorInLineup: true,
      mentorName: "Gomez",
      hasMentorLegacy: true,
    }));
    expect(debate!.mentorVoice).toBeTruthy();
    expect(debate!.mentorVoice?.isMentorVoice).toBe(true);
    expect(debate!.mentorVoice?.mentorName).toBe("Gomez");
  });

  it("mentor voice appears when mentor is retired (legacy)", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext({
      mentorInLineup: false, // retired
      hasMentorLegacy: true,
      mentorName: "Old Timer",
    }));
    expect(debate!.mentorVoice).toBeTruthy();
  });

  it("no mentor voice when hasMentorLegacy is false", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext({
      hasMentorLegacy: false,
      mentorInLineup: false,
    }));
    expect(debate!.mentorVoice).toBeUndefined();
  });

  it("voices are not isMentorVoice", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext());
    for (const voice of debate!.voices) {
      expect(voice.isMentorVoice).toBe(false);
    }
  });

  it("returns null when player has no mentalSkills at all", () => {
    const player = makePlayer();
    expect(selectActiveVoices(player, makeHighLeverageContext())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatVoiceDebate
// ---------------------------------------------------------------------------

describe("formatVoiceDebate", () => {
  it("formats voice debate as a multi-line string", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext())!;
    const formatted = formatVoiceDebate(debate);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("includes emoji markers", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext())!;
    const formatted = formatVoiceDebate(debate);
    expect(formatted).toContain("💭");
  });

  it("includes mentor voice marker and mentor name", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext({
      mentorInLineup: true,
      mentorName: "Gomez",
      hasMentorLegacy: true,
    }))!;
    const formatted = formatVoiceDebate(debate);
    expect(formatted).toContain("Gomez");
    expect(formatted).toContain("🎙️");
  });

  it("one line per voice", () => {
    const player = makePlayer({
      mentalSkills: [
        makeSkill("ice_veins", 4),
        makeSkill("clutch_composure", 3),
      ],
    });
    const debate = selectActiveVoices(player, makeHighLeverageContext())!;
    const formatted = formatVoiceDebate(debate);
    const lines = formatted.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(debate.voices.length);
  });
});
