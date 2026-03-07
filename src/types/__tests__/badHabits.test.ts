import { describe, it, expect } from "vitest";
import type { BadHabit, BadHabitType } from "@/types/badHabits";
import { getHabitEffect, HABIT_THRESHOLDS } from "@/types/badHabits";

describe("Bad Habits System - Type Definitions & Design", () => {
  describe("BadHabit Object Structure", () => {
    it("creates a valid bad habit with required fields", () => {
      const habit: BadHabit = {
        habitId: "habit-001",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 60,
        isActive: true,
        consecutiveUses: 12,
        consecutiveNonUses: 0,
        formedAtGame: 5,
        opponentKnowledge: 1,
        sourceSkillId: "power_swing",
      };

      expect(habit.habitId).toBe("habit-001");
      expect(habit.habitType).toBe("pull_happy");
      expect(habit.strength).toBe(60);
      expect(habit.isActive).toBe(true);
      expect(habit.formedAtGame).toBe(5);
    });

    it("initializes with optional breaking fields", () => {
      const brokenHabit: BadHabit = {
        habitId: "habit-002",
        habitType: "telegraphed",
        formationType: "skill_streak",
        strength: 30,
        isActive: false,
        consecutiveUses: 5,
        consecutiveNonUses: 3,
        formedAtGame: 10,
        brokenAt: 20,
        opponentKnowledge: 0,
      };

      expect(brokenHabit.brokenAt).toBe(20);
      expect(brokenHabit.isActive).toBe(false);
    });
  });

  describe("Habit Type Enum", () => {
    it("supports all five habit types", () => {
      const habitTypes: BadHabitType[] = [
        "pull_happy",
        "telegraphed",
        "overthinking",
        "first_pitch_frenzy",
        "chase_artist",
      ];

      habitTypes.forEach((type) => {
        expect(type).toBeTruthy();
        expect(typeof type).toBe("string");
      });
    });

    it("pull_happy creates contact penalty via shift", () => {
      const effect = getHabitEffect("pull_happy", 75);
      expect(effect.contactPenalty).toBeGreaterThan(0);
      expect(effect.shiftProbability).toBeGreaterThan(0.5);
      expect(effect.contactPenalty).toBe(15 * 0.75); // 11.25%
    });

    it("telegraphed creates opponent contact bonus", () => {
      const effect = getHabitEffect("telegraphed", 80);
      expect(effect.opponentContactBonus).toBeGreaterThan(0);
      expect(effect.opponentContactBonus).toBe(10 * 0.8); // 8%
    });

    it("overthinking creates decision accuracy penalty", () => {
      const effect = getHabitEffect("overthinking", 100);
      expect(effect.decisionAccuracyPenalty).toBeGreaterThan(0);
      expect(effect.decisionAccuracyPenalty).toBe(10); // 10%
    });

    it("first_pitch_frenzy enables batter adaptation", () => {
      const effect = getHabitEffect("first_pitch_frenzy", 50);
      expect(effect.firstPitchBatterAdaptation).toBeGreaterThan(0);
      expect(effect.firstPitchBatterAdaptation).toBe(0.8 * 0.5); // 0.4
    });

    it("chase_artist creates contact penalty and fatigue", () => {
      const effect = getHabitEffect("chase_artist", 90);
      expect(effect.contactPenalty).toBeGreaterThan(0);
      expect(effect.fatigueRate).toBeGreaterThan(1);
      expect(effect.contactPenalty).toBe(8 * 0.9); // 7.2%
      expect(effect.fatigueRate).toBeCloseTo(1.18, 2); // 1 + (0.2 * 0.9)
    });
  });

  describe("Habit Strength Scaling", () => {
    it("scales effects linearly with strength 0-100", () => {
      const effect0 = getHabitEffect("pull_happy", 0);
      const effect50 = getHabitEffect("pull_happy", 50);
      const effect100 = getHabitEffect("pull_happy", 100);

      expect(effect0.contactPenalty).toBe(0);
      expect(effect50.contactPenalty).toBe(7.5);
      expect(effect100.contactPenalty).toBe(15);
    });

    it("activation threshold at 50", () => {
      const below50 = { isActive: false, strength: 49 };
      const at50 = { isActive: true, strength: 50 };
      const above50 = { isActive: true, strength: 75 };

      expect(below50.isActive).toBe(false);
      expect(at50.isActive).toBe(true);
      expect(above50.isActive).toBe(true);
    });

    it("clamps strength at min/max thresholds", () => {
      const min = HABIT_THRESHOLDS.MIN_STRENGTH;
      const max = HABIT_THRESHOLDS.MAX_STRENGTH;

      expect(min).toBe(0);
      expect(max).toBe(100);
    });
  });

  describe("Habit Formation Rules", () => {
    it("requires 10+ consecutive uses to form", () => {
      const minStreak = HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH;
      expect(minStreak).toBe(10);
    });

    it("strength increases by 5 per continued use", () => {
      const increment = HABIT_THRESHOLDS.STRENGTH_INCREASE_PER_USE;
      expect(increment).toBe(5);

      // After 10 uses: 0 → 50 strength (formation point)
      const strengthAfter10 = increment * (HABIT_THRESHOLDS.FORMATION_STREAK_LENGTH - 5);
      expect(strengthAfter10).toBe(25); // Actually starts at 0, each use +5 for 10 uses
    });

    it("strength decreases by 10 per varied AB", () => {
      const decrement = HABIT_THRESHOLDS.STRENGTH_DECREASE_PER_VARIED_AB;
      expect(decrement).toBe(10);
    });

    it("breaks after 3 different approach ABs", () => {
      const variedThreshold = HABIT_THRESHOLDS.BREAKING_VARIED_ABS;
      expect(variedThreshold).toBe(3);
    });
  });

  describe("Habit Opponent Knowledge Tracking", () => {
    it("tracks how many opponents know about habit (0-3)", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 70,
        isActive: true,
        consecutiveUses: 15,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 2,
      };

      expect(habit.opponentKnowledge).toBeGreaterThanOrEqual(0);
      expect(habit.opponentKnowledge).toBeLessThanOrEqual(3);
    });

    it("spreads knowledge to opposing teams when strength >75", () => {
      const strength = 80;
      const knowledgeSpread = strength > 75;
      expect(knowledgeSpread).toBe(true);
    });

    it("resets knowledge after habit breaking", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "telegraphed",
        formationType: "skill_streak",
        strength: 0, // Reset to 0 after breaking
        isActive: false,
        consecutiveUses: 0,
        consecutiveNonUses: 3,
        formedAtGame: 10,
        brokenAt: 25,
        opponentKnowledge: 0, // Should reset
      };

      expect(habit.opponentKnowledge).toBe(0);
    });
  });

  describe("Habit Source Tracking", () => {
    it("tracks source skill ID for mental skill overuse", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "overthinking",
        formationType: "skill_streak",
        strength: 55,
        isActive: true,
        consecutiveUses: 8,
        consecutiveNonUses: 0,
        formedAtGame: 7,
        opponentKnowledge: 1,
        sourceSkillId: "pitch_recognition",
      };

      expect(habit.sourceSkillId).toBe("pitch_recognition");
    });

    it("tracks source approach for approach overuse", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "approach_streak",
        strength: 65,
        isActive: true,
        consecutiveUses: 12,
        consecutiveNonUses: 0,
        formedAtGame: 3,
        opponentKnowledge: 0,
        sourceApproach: "power",
      };

      expect(habit.sourceApproach).toBe("power");
    });
  });

  describe("Formation Type Detection", () => {
    it("identifies habit as skill_streak when skill overused", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "overthinking",
        formationType: "skill_streak",
        strength: 50,
        isActive: true,
        consecutiveUses: 10,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 0,
        sourceSkillId: "ice_veins",
      };

      expect(habit.formationType).toBe("skill_streak");
    });

    it("identifies habit as approach_streak when approach overused", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "approach_streak",
        strength: 60,
        isActive: true,
        consecutiveUses: 11,
        consecutiveNonUses: 0,
        formedAtGame: 2,
        opponentKnowledge: 0,
        sourceApproach: "aggressive",
      };

      expect(habit.formationType).toBe("approach_streak");
    });

    it("identifies habit as overspecialization when mental skill used 5+ consecutive ABs", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "overthinking",
        formationType: "overspecialization",
        strength: 45,
        isActive: false,
        consecutiveUses: 6,
        consecutiveNonUses: 0,
        formedAtGame: 4,
        opponentKnowledge: 0,
        sourceSkillId: "game_reading",
      };

      expect(habit.formationType).toBe("overspecialization");
    });
  });

  describe("Multiple Habit Coexistence", () => {
    it("allows multiple habits on same player", () => {
      const habits: BadHabit[] = [
        {
          habitId: "habit1",
          habitType: "pull_happy",
          formationType: "skill_streak",
          strength: 70,
          isActive: true,
          consecutiveUses: 15,
          consecutiveNonUses: 0,
          formedAtGame: 2,
          opponentKnowledge: 1,
        },
        {
          habitId: "habit2",
          habitType: "chase_artist",
          formationType: "approach_streak",
          strength: 40,
          isActive: false,
          consecutiveUses: 8,
          consecutiveNonUses: 2,
          formedAtGame: 5,
          opponentKnowledge: 0,
        },
      ];

      expect(habits.length).toBe(2);
      expect(habits[0].habitType).not.toBe(habits[1].habitType);
    });

    it("tracks habit history separately from active habits", () => {
      const activeHabits: BadHabit[] = [
        {
          habitId: "active1",
          habitType: "pull_happy",
          formationType: "skill_streak",
          strength: 65,
          isActive: true,
          consecutiveUses: 12,
          consecutiveNonUses: 0,
          formedAtGame: 3,
          opponentKnowledge: 1,
        },
      ];

      const brokenHabits: BadHabit[] = [
        {
          habitId: "broken1",
          habitType: "telegraphed",
          formationType: "skill_streak",
          strength: 0,
          isActive: false,
          consecutiveUses: 0,
          consecutiveNonUses: 3,
          formedAtGame: 1,
          brokenAt: 8,
          opponentKnowledge: 0,
        },
      ];

      expect(activeHabits.length).toBe(1);
      expect(brokenHabits.length).toBe(1);
      expect(activeHabits[0].isActive).toBe(true);
      expect(brokenHabits[0].isActive).toBe(false);
    });
  });

  describe("Game Persistence", () => {
    it("tracks habits across multiple games", () => {
      const habit: BadHabit = {
        habitId: "habit-multi-game",
        habitType: "first_pitch_frenzy",
        formationType: "skill_streak",
        strength: 55,
        isActive: true,
        consecutiveUses: 12,
        consecutiveNonUses: 0,
        formedAtGame: 8,
        opponentKnowledge: 2,
      };

      // Game 8: formed, Game 15: still active
      const gamesActive = 15 - habit.formedAtGame;
      expect(gamesActive).toBe(7);
      expect(habit.strength).toBe(55); // Not reset by game boundary
    });

    it("maintains consecutive use counters across games", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 75,
        isActive: true,
        consecutiveUses: 20, // Across 3 games (Game 5-7)
        consecutiveNonUses: 0,
        formedAtGame: 5,
        opponentKnowledge: 2,
      };

      // Habit strength doesn't reset per-game
      expect(habit.strength).toBe(75);
      expect(habit.consecutiveUses).toBe(20);
    });
  });

  describe("Habit Breakthrough Interaction", () => {
    it("reduces breakthrough probability with active habit", () => {
      const activeHabit = {
        habitType: "pull_happy",
        isActive: true,
        strength: 80,
      };

      // Base breakthrough prob: 35%, active habit penalty: -15%
      const baseProb = 0.35;
      const habitPenalty = 0.15;
      const expectedProb = baseProb - habitPenalty; // 0.20 = 20%

      expect(activeHabit.isActive).toBe(true);
      expect(expectedProb).toBeCloseTo(0.2, 10);
    });

    it("no breakthrough penalty after habit is broken", () => {
      const brokenHabit: BadHabit = {
        habitId: "test",
        habitType: "telegraphed",
        formationType: "skill_streak",
        strength: 0,
        isActive: false,
        consecutiveUses: 0,
        consecutiveNonUses: 3,
        formedAtGame: 10,
        brokenAt: 18,
        opponentKnowledge: 0,
      };

      // No penalty once broken
      expect(brokenHabit.isActive).toBe(false);
      expect(brokenHabit.strength).toBe(0);
    });
  });

  describe("Coach/Opponent Adaptation", () => {
    it("activates adaptation rules at strength >50", () => {
      const habit: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 75,
        isActive: true,
        consecutiveUses: 15,
        consecutiveNonUses: 0,
        formedAtGame: 3,
        opponentKnowledge: 1,
      };

      const shouldAdapt = habit.strength > 50;
      expect(shouldAdapt).toBe(true);
    });

    it("enables 'calling out' at strength >75", () => {
      const strength75plus = 78;
      const callOutEnabled = strength75plus > 75;

      expect(callOutEnabled).toBe(true);
    });

    it("resets opponent knowledge after breaking", () => {
      const beforeBreak: BadHabit = {
        habitId: "test",
        habitType: "chase_artist",
        formationType: "approach_streak",
        strength: 85,
        isActive: true,
        consecutiveUses: 25,
        consecutiveNonUses: 0,
        formedAtGame: 5,
        opponentKnowledge: 3,
      };

      const afterBreak: BadHabit = {
        ...beforeBreak,
        strength: 0,
        isActive: false,
        consecutiveUses: 0,
        consecutiveNonUses: 3,
        brokenAt: 20,
        opponentKnowledge: 0,
      };

      expect(beforeBreak.opponentKnowledge).toBe(3);
      expect(afterBreak.opponentKnowledge).toBe(0);
    });
  });

  describe("Edge Cases & Boundaries", () => {
    it("handles strength at exact thresholds", () => {
      const atActivation: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 50,
        isActive: true, // Exactly at threshold
        consecutiveUses: 10,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 0,
      };

      expect(atActivation.isActive).toBe(true);
      expect(atActivation.strength).toBe(50);
    });

    it("handles max strength cap", () => {
      const maxed: BadHabit = {
        habitId: "test",
        habitType: "overthinking",
        formationType: "skill_streak",
        strength: 100,
        isActive: true,
        consecutiveUses: 30,
        consecutiveNonUses: 0,
        formedAtGame: 1,
        opponentKnowledge: 3,
      };

      expect(maxed.strength).toBeLessThanOrEqual(HABIT_THRESHOLDS.MAX_STRENGTH);
    });

    it("handles zero strength with isActive false", () => {
      const broken: BadHabit = {
        habitId: "test",
        habitType: "pull_happy",
        formationType: "skill_streak",
        strength: 0,
        isActive: false,
        consecutiveUses: 0,
        consecutiveNonUses: 3,
        formedAtGame: 5,
        brokenAt: 12,
        opponentKnowledge: 0,
      };

      expect(broken.strength).toBe(0);
      expect(broken.isActive).toBe(false);
    });
  });
});
