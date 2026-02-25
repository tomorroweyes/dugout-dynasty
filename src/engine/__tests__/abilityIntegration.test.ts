import { describe, it, expect } from "vitest";
import { Player, BatterStats, PitcherStats } from "@/types/game";
import type { PlayerAbility } from "@/types/ability";
import { calculateDerivedStats, calculateTechniqueBonus } from "../techniqueStats";
import {
  getPassiveAbilityContext,
  mergeAbilityContexts,
  decideBatterAbility,
  decidePitcherAbility,
  processAbilityActivation,
} from "../abilityAI";
import { getAbilityById } from "@/data/abilities";
import {
  generatePlayer,
  assignArchetypeAndAbilities,
  getTechniqueCountForTier,
} from "../playerGenerator";
import { generateOpponentTeam } from "../leagueGenerator";
import { regenerateSpirit } from "../abilitySystem";
import { SeededRandomProvider } from "../randomProvider";

// ============================================
// MOCK PLAYER HELPERS
// ============================================

function createAbilityBatter(overrides: Partial<Player> = {}): Player {
  return {
    id: "test-batter",
    name: "Test Batter",
    surname: "Batter",
    role: "Batter",
    stats: { power: 50, contact: 50, glove: 50, speed: 50 },
    salary: 100,
    level: 10,
    xp: 0,
    totalXpEarned: 0,
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
    class: "Contact Hitter",
    spirit: { current: 50, max: 50 },
    abilities: [],
    skillPoints: 0,
    ...overrides,
  };
}

function createAbilityPitcher(overrides: Partial<Player> = {}): Player {
  return {
    id: "test-pitcher",
    name: "Test Pitcher",
    surname: "Pitcher",
    role: "Starter",
    stats: { velocity: 50, control: 50, break: 50 },
    salary: 100,
    level: 10,
    xp: 0,
    totalXpEarned: 0,
    equipment: {
      bat: null,
      glove: null,
      cap: null,
      cleats: null,
      accessory: null,
    },
    class: "Flamethrower",
    spirit: { current: 50, max: 50 },
    abilities: [],
    skillPoints: 0,
    ...overrides,
  };
}

// ============================================
// PHASE 0: REGISTRY UNIFICATION
// ============================================

describe("Registry Unification", () => {
  it("should resolve legacy batter abilities via getAbilityById", () => {
    const ability = getAbilityById("moonshot");
    expect(ability).toBeDefined();
    expect(ability!.name).toBe("Moonshot");
    expect(ability!.requiredClass).toBe("Slugger");
  });

  it("should resolve new pitcher techniques via getAbilityById", () => {
    const ability = getAbilityById("heat_up");
    expect(ability).toBeDefined();
    expect(ability!.name).toBe("Heat Up");
    expect(ability!.requiredClass).toBe("Flamethrower");
  });

  it("should resolve all archetype starter techniques", () => {
    const starters = [
      "moonshot",
      "two_strike_assassin",
      "crazy_bunt",
      "heat_up",
      "pinpoint",
      "vanishing_act",
    ];
    for (const id of starters) {
      const ability = getAbilityById(id);
      expect(ability, `Ability ${id} should be resolvable`).toBeDefined();
    }
  });
});

// ============================================
// PHASE 1: STAT DOUBLE-APPLICATION FIX
// ============================================

describe("Stat Double-Application Fix", () => {
  it("should only include passive technique stat bonuses in calculateTechniqueBonus", () => {
    // "patience" is passive (isPassive: true) with contact: 15
    const passiveAbilities: PlayerAbility[] = [
      { abilityId: "patience", rank: 1, timesUsed: 0 },
    ];
    const bonus = calculateTechniqueBonus(passiveAbilities);
    expect(bonus.contact).toBe(15);
  });

  it("should exclude active technique stat bonuses from calculateTechniqueBonus", () => {
    // "heat_up" is NOT passive, has velocity: +20
    const activeAbilities: PlayerAbility[] = [
      { abilityId: "heat_up", rank: 1, timesUsed: 0 },
    ];
    const bonus = calculateTechniqueBonus(activeAbilities);
    expect(bonus.velocity).toBeUndefined();
  });

  it("should not include active ability stat bonuses in calculateDerivedStats", () => {
    const pitcher = createAbilityPitcher({
      abilities: [{ abilityId: "heat_up", rank: 1, timesUsed: 0 }],
    });
    const derived = calculateDerivedStats(pitcher) as PitcherStats;
    // heat_up gives +20 velocity but it's an active ability, so no permanent bonus
    // Flamethrower archetype base velocity is 70
    // If heat_up were included (bug), it would be 90
    expect(derived.velocity).toBe(70); // Archetype base only, NOT 90
  });

  it("should include passive ability stat bonuses in calculateDerivedStats", () => {
    const pitcher = createAbilityPitcher({
      class: "Trickster",
      abilities: [{ abilityId: "repertoire", rank: 1, timesUsed: 0 }],
    });
    const derived = calculateDerivedStats(pitcher) as PitcherStats;
    // repertoire is passive with break: 15
    expect(derived.break).toBeGreaterThanOrEqual(65); // 50 base + 15 from passive
  });
});

// ============================================
// PHASE 2: PASSIVE ABILITY AUTO-APPLICATION
// ============================================

describe("Passive Ability Auto-Application", () => {
  it("should build passive ability context with all passive effects merged", () => {
    const batter = createAbilityBatter({
      abilities: [{ abilityId: "patience", rank: 1, timesUsed: 0 }],
    });

    const context = getPassiveAbilityContext(batter);
    expect(context).not.toBeNull();
    expect(context!.abilityId).toBe("__passive_bundle__");
    expect(context!.effects.length).toBeGreaterThan(0);

    // Check that patience effects are present (stat_modifier with contact: 15 and outcome_modifier with walkBonus: 15)
    const statMod = context!.effects.find((e) => e.type === "stat_modifier");
    expect(statMod).toBeDefined();
    const outcomeMod = context!.effects.find(
      (e) => e.type === "outcome_modifier"
    );
    expect(outcomeMod).toBeDefined();
  });

  it("should return null for player with no passive abilities", () => {
    const batter = createAbilityBatter({
      abilities: [{ abilityId: "moonshot", rank: 1, timesUsed: 0 }],
      class: "Slugger",
    });

    const context = getPassiveAbilityContext(batter);
    expect(context).toBeNull();
  });

  it("should exclude passive abilities from decideBatterAbility", () => {
    // Player with ONLY a passive ability — AI should not try to randomly activate it
    const batter = createAbilityBatter({
      abilities: [{ abilityId: "patience", rank: 1, timesUsed: 0 }],
    });
    const rng = new SeededRandomProvider(42);

    // Run many times — should always return null since the only ability is passive
    for (let i = 0; i < 50; i++) {
      const result = decideBatterAbility({ player: batter, random: rng });
      expect(result).toBeNull();
    }
  });

  it("should merge passive and active contexts correctly", () => {
    const passive = {
      playerId: "p1",
      abilityId: "__passive_bundle__",
      effects: [
        { type: "stat_modifier" as const, contact: 15, duration: "game" as const },
      ],
      activatedAt: "pre_at_bat" as const,
    };
    const active = {
      playerId: "p1",
      abilityId: "moonshot",
      effects: [
        { type: "stat_modifier" as const, power: 50, duration: "at_bat" as const },
      ],
      activatedAt: "pre_at_bat" as const,
    };

    const merged = mergeAbilityContexts(passive, active);
    expect(merged).toBeDefined();
    expect(merged!.abilityId).toBe("moonshot"); // Uses active's ID
    expect(merged!.effects).toHaveLength(2); // Both effects present
  });

  it("should return passive context when no active ability", () => {
    const passive = {
      playerId: "p1",
      abilityId: "__passive_bundle__",
      effects: [
        { type: "stat_modifier" as const, contact: 15, duration: "game" as const },
      ],
      activatedAt: "pre_at_bat" as const,
    };

    const merged = mergeAbilityContexts(passive, null);
    expect(merged).toBeDefined();
    expect(merged!.abilityId).toBe("__passive_bundle__");
  });
});

// ============================================
// PHASE 3: OPPONENT GENERATION WITH ABILITIES
// ============================================

describe("Opponent Generation with Abilities", () => {
  it("should assign archetype and starter technique to a batter", () => {
    const rng = new SeededRandomProvider(42);
    const player = generatePlayer("Batter", "SOLID", rng);
    const withAbilities = assignArchetypeAndAbilities(player, 0, rng);

    expect(withAbilities.class).toBeDefined();
    expect(["Slugger", "Contact Hitter", "Speed Demon"]).toContain(
      withAbilities.class
    );
    expect(withAbilities.abilities.length).toBe(1); // Starter technique
    expect(withAbilities.spirit.max).toBeGreaterThan(0);
    expect(withAbilities.spirit.current).toBe(withAbilities.spirit.max);
  });

  it("should assign archetype and starter technique to a pitcher", () => {
    const rng = new SeededRandomProvider(123);
    const player = generatePlayer("Starter", "SOLID", rng);
    const withAbilities = assignArchetypeAndAbilities(player, 0, rng);

    expect(withAbilities.class).toBeDefined();
    expect(["Flamethrower", "Painter", "Trickster"]).toContain(
      withAbilities.class
    );
    expect(withAbilities.abilities.length).toBe(1);
  });

  it("should grant additional techniques based on count", () => {
    const rng = new SeededRandomProvider(42);
    const player = generatePlayer("Batter", "SOLID", rng);
    const withAbilities = assignArchetypeAndAbilities(player, 3, rng);

    // Should have starter + up to 3 additional
    expect(withAbilities.abilities.length).toBeGreaterThanOrEqual(2);
    expect(withAbilities.abilities.length).toBeLessThanOrEqual(4);
  });

  it("should scale technique count with league tier", () => {
    expect(getTechniqueCountForTier("SANDLOT")).toBe(0);
    expect(getTechniqueCountForTier("LOCAL")).toBe(1);
    expect(getTechniqueCountForTier("REGIONAL")).toBe(2);
    expect(getTechniqueCountForTier("NATIONAL")).toBe(3);
    expect(getTechniqueCountForTier("WORLD")).toBe(4);
  });

  it("should generate opponent team with abilities at REGIONAL tier", () => {
    const rng = new SeededRandomProvider(42);
    const opponent = generateOpponentTeam("REGIONAL", rng);

    // Every player should have a class and at least 1 ability
    for (const player of opponent.roster) {
      expect(player.class).toBeDefined();
      expect(player.abilities.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================
// PHASE 5: BATTER SPIRIT TRACKING
// ============================================

describe("Batter Spirit Tracking", () => {
  it("should deduct spirit when active ability is used", () => {
    const batter = createAbilityBatter({
      class: "Slugger",
      spirit: { current: 50, max: 50 },
      abilities: [{ abilityId: "moonshot", rank: 1, timesUsed: 0 }],
    });

    const abilityContext = {
      playerId: batter.id,
      abilityId: "moonshot",
      effects: [],
      activatedAt: "pre_at_bat" as const,
    };

    const updated = processAbilityActivation(batter, abilityContext);
    expect(updated.spirit.current).toBeLessThan(50);
    expect(updated.abilities[0].timesUsed).toBe(1);
  });
});

// ============================================
// PHASE 7: SPIRIT REGENERATION
// ============================================

describe("Spirit Regeneration", () => {
  it("should restore spirit to max after calling regenerateSpirit", () => {
    const player = createAbilityBatter({
      level: 5,
      spirit: { current: 10, max: 70 },
    });

    const restored = regenerateSpirit(player);
    expect(restored.spirit.current).toBe(restored.spirit.max);
    expect(restored.spirit.max).toBeGreaterThan(0);
  });

  it("should update max spirit based on player level", () => {
    const player = createAbilityBatter({
      level: 10,
      spirit: { current: 0, max: 50 },
    });

    const restored = regenerateSpirit(player);
    // Max spirit = 50 + (level - 1) * 5 = 50 + 45 = 95
    expect(restored.spirit.max).toBe(95);
    expect(restored.spirit.current).toBe(95);
  });
});
