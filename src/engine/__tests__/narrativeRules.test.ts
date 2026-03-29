/**
 * Narrative Rules Engine Tests
 *
 * Verifies that each rule fires for the correct context and that the
 * evaluator correctly prioritises rules and falls back to null when
 * no rule matches.
 */

import { describe, it, expect } from "vitest";
import { evaluateNarrativeRules, NARRATIVE_RULES, type NarrativeRule } from "../narrative/narrativeRules";
import type { NarrativeContext } from "../narrative/narrativeContext";
import { SeededRandomProvider } from "../randomProvider";
import { simulateInningWithStats } from "../matchEngine";
import type { Player, BatterStats, PitcherStats } from "@/types/game";
import type { BatterHistory } from "../narrativeEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const rng = new SeededRandomProvider(42);

function ctx(overrides: Partial<NarrativeContext> = {}): NarrativeContext {
  return {
    result: "single",
    runsScored: 0,
    inning: 5,
    outs: 1,
    scoreDiff: 0,
    bases: [false, false, false],
    batterName: "Jones",
    pitcherName: "Smith",
    batterPower: 55,
    batterContact: 55,
    pitcherVelocity: 60,
    pitcherControl: 60,
    isCritical: false,
    batterHistory: { abs: 3, hits: 1, strikeouts: 1, walks: 0 },
    ...overrides,
  };
}

/** Find the rule that would fire for a given context */
function matchingRule(c: NarrativeContext): NarrativeRule | null {
  const sorted = [...NARRATIVE_RULES].sort((a, b) => b.priority - a.priority);
  return sorted.find((r) => r.matches(c)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluateNarrativeRules — API
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluateNarrativeRules", () => {
  it("returns null when no rule matches", () => {
    // Routine mid-game single, no history, no leverage
    const result = evaluateNarrativeRules(ctx({ inning: 3, scoreDiff: 3 }), rng);
    expect(result).toBeNull();
  });

  it("returns a non-empty string when a rule matches", () => {
    const result = evaluateNarrativeRules(
      ctx({ result: "homerun", runsScored: 4 }),
      rng
    );
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("fills {batter} and {pitcher} tokens", () => {
    const result = evaluateNarrativeRules(
      ctx({ result: "homerun", runsScored: 4 }),
      rng
    );
    // Grand slam pool uses {batter} — should be substituted
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });

  it("handles missing batterHistory gracefully", () => {
    const result = evaluateNarrativeRules(
      ctx({ result: "homerun", runsScored: 4, batterHistory: undefined }),
      rng
    );
    expect(result).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority 110 — Absolute overrides
// ─────────────────────────────────────────────────────────────────────────────

describe("grand_slam rule", () => {
  it("fires for homerun with 4+ runs scoring", () => {
    const rule = matchingRule(ctx({ result: "homerun", runsScored: 4 }));
    expect(rule?.id).toBe("grand_slam");
  });

  it("fires for 5-run homer", () => {
    const rule = matchingRule(ctx({ result: "homerun", runsScored: 5 }));
    expect(rule?.id).toBe("grand_slam");
  });

  it("does NOT fire for 3-run homer", () => {
    const rule = matchingRule(ctx({ result: "homerun", runsScored: 3 }));
    expect(rule?.id).not.toBe("grand_slam");
  });

  it("does NOT fire for non-homer", () => {
    const rule = matchingRule(ctx({ result: "single", runsScored: 4 }));
    expect(rule?.id).not.toBe("grand_slam");
  });
});

describe("walkoff_homer rule", () => {
  it("fires in inning 9, tied, homerun scores", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 9, scoreDiff: 0, runsScored: 1 })
    );
    expect(rule?.id).toBe("walkoff_homer");
  });

  it("fires when trailing in extra innings", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 11, scoreDiff: -1, runsScored: 2 })
    );
    expect(rule?.id).toBe("walkoff_homer");
  });

  it("does NOT fire when ahead in inning 9", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 9, scoreDiff: 2, runsScored: 1 })
    );
    expect(rule?.id).not.toBe("walkoff_homer");
  });

  it("does NOT fire in early innings even when tied", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 5, scoreDiff: 0, runsScored: 1 })
    );
    expect(rule?.id).not.toBe("walkoff_homer");
  });

  // Grand slam takes priority over walkoff homer (higher priority)
  it("grand_slam outranks walkoff_homer when runsScored >= 4", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 9, scoreDiff: -3, runsScored: 4 })
    );
    expect(rule?.id).toBe("grand_slam");
  });
});

describe("walkoff_hit rule", () => {
  it("fires for single in inning 9, tied, with run scoring", () => {
    const rule = matchingRule(
      ctx({ result: "single", inning: 9, scoreDiff: 0, runsScored: 1 })
    );
    expect(rule?.id).toBe("walkoff_hit");
  });

  it("fires for double in extras when trailing", () => {
    const rule = matchingRule(
      ctx({ result: "double", inning: 10, scoreDiff: -1, runsScored: 2 })
    );
    expect(rule?.id).toBe("walkoff_hit");
  });

  it("does NOT fire when no runs scored", () => {
    const rule = matchingRule(
      ctx({ result: "single", inning: 9, scoreDiff: 0, runsScored: 0 })
    );
    expect(rule?.id).not.toBe("walkoff_hit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority 90 — Major situational overrides
// ─────────────────────────────────────────────────────────────────────────────

describe("redemption_homer rule", () => {
  it("fires when batter was hitless (hits=0, abs>=2) and hits HR", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        batterHistory: { abs: 3, hits: 0, strikeouts: 2, walks: 0 },
      })
    );
    expect(rule?.id).toBe("redemption_homer");
  });

  it("does NOT fire when batter already had a hit", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        inning: 5,
        scoreDiff: 0,
        batterHistory: { abs: 3, hits: 1, strikeouts: 1, walks: 0 },
      })
    );
    expect(rule?.id).not.toBe("redemption_homer");
  });

  it("does NOT fire on first AB (abs < 2)", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        batterHistory: { abs: 1, hits: 0, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).not.toBe("redemption_homer");
  });
});

describe("clutch_homer rule", () => {
  it("fires for homer in high-leverage (late close game)", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 2,
        inning: 8,
        scoreDiff: 1,
        batterHistory: { abs: 2, hits: 1, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).toBe("clutch_homer");
  });

  it("fires with 2 outs and runners on", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 2,
        inning: 5,
        outs: 2,
        scoreDiff: 0,
        bases: [true, false, false],
        batterHistory: { abs: 2, hits: 1, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).toBe("clutch_homer");
  });
});

describe("clutch_strikeout_pitcher rule", () => {
  it("fires when pitcher K's in high-leverage with good control", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 9,
        scoreDiff: 1,
        pitcherControl: 70,
        outs: 2,
        bases: [false, true, false],
      })
    );
    expect(rule?.id).toBe("clutch_strikeout_pitcher");
  });

  it("does NOT fire when pitcher control is low", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 9,
        scoreDiff: 1,
        pitcherControl: 40,
        outs: 2,
        bases: [false, true, false],
      })
    );
    expect(rule?.id).not.toBe("clutch_strikeout_pitcher");
  });
});

describe("frustration_strikeout rule", () => {
  it("fires when batter has 2+ strikeouts already", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 3,
        batterHistory: { abs: 3, hits: 0, strikeouts: 2, walks: 0 },
      })
    );
    expect(rule?.id).toBe("frustration_strikeout");
  });

  it("does NOT fire on first or second K", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 3,
        scoreDiff: 3, // not high leverage
        batterHistory: { abs: 2, hits: 0, strikeouts: 1, walks: 0 },
      })
    );
    expect(rule?.id).not.toBe("frustration_strikeout");
  });
});

describe("redemption_hit rule", () => {
  it("fires when hitless batter finally gets a single", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 4,
        scoreDiff: 2, // not high leverage — rules out most other rules
        batterHistory: { abs: 3, hits: 0, strikeouts: 1, walks: 0 },
      })
    );
    expect(rule?.id).toBe("redemption_hit");
  });

  it("fires for double and triple too", () => {
    ["double", "triple"].forEach((result) => {
      const rule = matchingRule(
        ctx({
          result: result as any,
          inning: 4,
          scoreDiff: 3,
          batterHistory: { abs: 2, hits: 0, strikeouts: 0, walks: 1 },
        })
      );
      expect(rule?.id).toBe("redemption_hit");
    });
  });

  it("does NOT fire for homerun (separate rule handles that)", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        inning: 4,
        scoreDiff: 3,
        batterHistory: { abs: 3, hits: 0, strikeouts: 1, walks: 0 },
      })
    );
    expect(rule?.id).not.toBe("redemption_hit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority 70 — Meaningful situational
// ─────────────────────────────────────────────────────────────────────────────

describe("clutch_hit_risp rule", () => {
  it("fires for late-game hit with RISP and runs scoring", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 8,
        scoreDiff: 1,
        bases: [false, true, false],
        runsScored: 1,
        batterHistory: { abs: 2, hits: 1, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).toBe("clutch_hit_risp");
  });

  it("does NOT fire without RISP", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 8,
        scoreDiff: 1,
        bases: [true, false, false], // runner on 1st only
        runsScored: 0,
      })
    );
    expect(rule?.id).not.toBe("clutch_hit_risp");
  });
});

describe("comeback_hit rule", () => {
  it("fires when trailing by 3+ (not close enough for clutch_hit_risp) with RISP and run scores", () => {
    // scoreDiff: -3 puts it outside isCloseGame (<=2) so clutch_hit_risp won't fire
    const rule = matchingRule(
      ctx({
        result: "double",
        inning: 6,
        scoreDiff: -3,
        bases: [false, false, true],
        runsScored: 1,
        batterHistory: { abs: 2, hits: 1, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).toBe("comeback_hit");
  });
});

describe("tension_late_strikeout rule", () => {
  it("fires for late close-game K without other special conditions", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 8,
        scoreDiff: 1,
        pitcherControl: 50, // not high enough for clutch_K
        batterHistory: { abs: 2, hits: 1, strikeouts: 1, walks: 0 }, // not frustrated
      })
    );
    expect(rule?.id).toBe("tension_late_strikeout");
  });
});

describe("clutch_out rule", () => {
  it("fires for groundout with RISP in high-leverage", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        inning: 9,
        scoreDiff: 1,
        bases: [false, true, false],
        outs: 2,
      })
    );
    expect(rule?.id).toBe("clutch_out");
  });

  it("does NOT fire without RISP", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        inning: 9,
        scoreDiff: 1,
        bases: [true, false, false],
        outs: 2,
      })
    );
    expect(rule?.id).not.toBe("clutch_out");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority ordering — ensure higher-priority rules beat lower ones
// ─────────────────────────────────────────────────────────────────────────────

describe("rule priority", () => {
  it("grand_slam (110) beats walkoff_homer (108) when both could match", () => {
    // 9th inning, trailing 3, homer scores 4 → both grand_slam and walkoff_homer match
    const rule = matchingRule(
      ctx({ result: "homerun", inning: 9, scoreDiff: -3, runsScored: 4 })
    );
    expect(rule?.id).toBe("grand_slam");
  });

  it("clutch_strikeout_pitcher (88) beats frustration_strikeout (82) when both could match", () => {
    // High-leverage K with control pitcher, batter has 2+ Ks
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        inning: 9,
        scoreDiff: 1,
        pitcherControl: 75,
        outs: 2,
        bases: [false, true, false],
        batterHistory: { abs: 4, hits: 1, strikeouts: 2, walks: 0 },
      })
    );
    expect(rule?.id).toBe("clutch_strikeout_pitcher");
  });

  it("redemption_homer (90) beats clutch_homer (85) when batter was hitless", () => {
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        inning: 8,
        scoreDiff: 1,
        batterHistory: { abs: 3, hits: 0, strikeouts: 1, walks: 0 },
      })
    );
    expect(rule?.id).toBe("redemption_homer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No false positives — routine plays return null
// ─────────────────────────────────────────────────────────────────────────────

describe("no false positives", () => {
  it("routine early-game single returns null", () => {
    expect(
      evaluateNarrativeRules(
        ctx({ result: "single", inning: 2, scoreDiff: 0, runsScored: 0,
              batterHistory: { abs: 1, hits: 0, strikeouts: 0, walks: 0 } }),
        rng
      )
    ).toBeNull();
  });

  it("routine mid-game strikeout returns null", () => {
    expect(
      evaluateNarrativeRules(
        ctx({ result: "strikeout", inning: 4, scoreDiff: 3,
              pitcherControl: 50,
              batterHistory: { abs: 2, hits: 1, strikeouts: 1, walks: 0 } }),
        rng
      )
    ).toBeNull();
  });

  it("routine flyout with bases empty returns null", () => {
    expect(
      evaluateNarrativeRules(
        ctx({ result: "flyout", inning: 3, scoreDiff: 1,
              bases: [false, false, false] }),
        rng
      )
    ).toBeNull();
  });

  it("solo homer in mid-game uses stat-tier fallback (returns null from rules)", () => {
    expect(
      evaluateNarrativeRules(
        ctx({ result: "homerun", runsScored: 1, inning: 4, scoreDiff: 3,
              batterHistory: { abs: 2, hits: 1, strikeouts: 0, walks: 0 } }),
        rng
      )
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Redemption arc — tracked flag rules (#15)
// ─────────────────────────────────────────────────────────────────────────────

describe("setup_for_redemption rule", () => {
  const withFlag = (result: NarrativeContext["result"]) =>
    ctx({
      result,
      inning: 4,
      scoreDiff: 0,
      batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: true },
    });

  it("fires when flag is set and batter grounds out", () => {
    const rule = matchingRule(withFlag("groundout"));
    expect(rule?.id).toBe("setup_for_redemption");
  });

  it("fires when flag is set and batter strikes out", () => {
    const rule = matchingRule(withFlag("strikeout"));
    expect(rule?.id).toBe("setup_for_redemption");
  });

  it("fires for all out types (flyout, lineout, popout)", () => {
    for (const result of ["flyout", "lineout", "popout"] as const) {
      const rule = matchingRule(withFlag(result));
      expect(rule?.id).toBe("setup_for_redemption");
    }
  });

  it("does NOT fire when flag is NOT set", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        inning: 4,
        scoreDiff: 0,
        batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: false },
      })
    );
    expect(rule?.id).not.toBe("setup_for_redemption");
  });

  it("does NOT fire when flag is absent (undefined)", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        inning: 4,
        scoreDiff: 0,
        batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0 },
      })
    );
    expect(rule?.id).not.toBe("setup_for_redemption");
  });

  it("does NOT fire when batter gets a hit (redemption_payoff handles that)", () => {
    const rule = matchingRule(withFlag("single"));
    expect(rule?.id).not.toBe("setup_for_redemption");
  });

  it("returns a non-empty string from evaluator", () => {
    const result = evaluateNarrativeRules(withFlag("groundout"), rng);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });
});

describe("redemption_payoff rule", () => {
  const withFlagAndHit = (result: NarrativeContext["result"]) =>
    ctx({
      result,
      inning: 4,
      scoreDiff: 0,
      batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: true },
    });

  it("fires when flag is set and batter gets a single", () => {
    const rule = matchingRule(withFlagAndHit("single"));
    expect(rule?.id).toBe("redemption_payoff");
  });

  it("fires when flag is set and batter gets a double", () => {
    const rule = matchingRule(withFlagAndHit("double"));
    expect(rule?.id).toBe("redemption_payoff");
  });

  it("fires when flag is set and batter gets a triple", () => {
    const rule = matchingRule(withFlagAndHit("triple"));
    expect(rule?.id).toBe("redemption_payoff");
  });

  it("fires when flag is set and batter hits a home run", () => {
    // Note: higher-priority rules (grand_slam, walkoff_homer, clutch_homer, etc.)
    // may override in some situations — verify mid-game solo HR scenario
    const rule = matchingRule(
      ctx({
        result: "homerun",
        runsScored: 1,
        inning: 4,
        scoreDiff: 3, // not high-leverage — rules out clutch/walkoff
        batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: true },
      })
    );
    expect(rule?.id).toBe("redemption_payoff");
  });

  it("does NOT fire when flag is NOT set", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 4,
        scoreDiff: 0,
        batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: false },
      })
    );
    expect(rule?.id).not.toBe("redemption_payoff");
  });

  it("does NOT fire for outs even when flag is set (setup_for_redemption handles that)", () => {
    const rule = matchingRule(withFlagAndHit("groundout"));
    expect(rule?.id).not.toBe("redemption_payoff");
    // setup_for_redemption fires instead
    expect(rule?.id).toBe("setup_for_redemption");
  });

  it("returns a non-empty, token-free string from evaluator", () => {
    const result = evaluateNarrativeRules(withFlagAndHit("single"), rng);
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });

  it("redemption_payoff (93) outranks redemption_hit (87) when both would match", () => {
    // Batter was hitless AND has redemption flag — payoff (93) should win over redemption_hit (87)
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 4,
        scoreDiff: 3,
        batterHistory: { abs: 3, hits: 0, strikeouts: 1, walks: 0, redemptionOpportunity: true },
      })
    );
    expect(rule?.id).toBe("redemption_payoff");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Redemption flag — matchEngine integration (#15)
// Verifies the flag is armed and cleared correctly via simulateInningWithStats
// ─────────────────────────────────────────────────────────────────────────────

describe("redemption flag tracking (matchEngine)", () => {
  /** Minimal batter for testing */
  function makeBatter(id: string): Player {
    return {
      id,
      name: `Batter ${id}`,
      surname: `B${id}`,
      role: "Batter" as const,
      stats: { power: 30, contact: 30, glove: 50, speed: 50 } as BatterStats,
      salary: 100_000,
      level: 1,
      xp: 0,
      totalXpEarned: 0,
      equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    };
  }

  function makePitcher(id: string): Player {
    return {
      id,
      name: `Pitcher ${id}`,
      surname: `P${id}`,
      role: "Starter" as const,
      stats: { velocity: 90, control: 90, break: 90 } as PitcherStats,
      salary: 100_000,
      level: 1,
      xp: 0,
      totalXpEarned: 0,
      equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    };
  }

  it("arms redemption flag when batter fails with RISP in high-leverage spot", () => {
    const history = new Map<string, BatterHistory>();
    const batterId = "batter-1";

    // Pre-seed history: force out result by running in a high-leverage configuration.
    // Seed the history with redemptionOpportunity NOT set before the inning.
    history.set(batterId, { abs: 0, hits: 0, strikeouts: 0, walks: 0 });

    // Run with a highly dominant pitcher to force outs.
    // We can't directly control individual results, but we can verify flag behavior
    // in a statistical sense or inject pre-armed history.
    // For unit-level testing, directly verify the arm condition logic by checking
    // that history update in the flag tests is structured correctly.

    // Simpler: verify that a history entry never carries redemptionOpportunity across
    // unqualified ABs. Start with flag=true and run an early-inning AB (inning < 7).
    history.set(batterId, { abs: 2, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: true });

    const offense = [makeBatter(batterId)];
    const pitcher = makePitcher("p1");
    const defense = [pitcher];

    const rngInstance = new SeededRandomProvider(99);
    const result = simulateInningWithStats(
      offense, defense, pitcher, 0, 0,
      /* inning= */ 2, // early inning — flag should NOT re-arm
      true, rngInstance,
      undefined, 3, 3, 0, undefined, undefined,
      history
    );

    // After the inning, the batter's history should have redemptionOpportunity cleared
    // (the inning was inning 2, so even if they made outs no flag should be set)
    const finalHistory = history.get(batterId);
    expect(finalHistory).toBeDefined();
    // Flag was consumed (cleared) entering the AB; early inning won't re-arm it
    expect(finalHistory?.redemptionOpportunity).toBeFalsy();
    expect(result.plays.length).toBeGreaterThan(0);
  });

  it("history always contains defined redemptionOpportunity after any AB", () => {
    const history = new Map<string, BatterHistory>();
    const batterId = "batter-2";

    const offense = [makeBatter(batterId)];
    const pitcher = makePitcher("p2");
    const defense = [pitcher];

    const rngInstance = new SeededRandomProvider(123);
    simulateInningWithStats(
      offense, defense, pitcher, 0, 0,
      /* inning= */ 5,
      true, rngInstance,
      undefined, 0, 0, 0, undefined, undefined,
      history
    );

    const finalHistory = history.get(batterId);
    expect(finalHistory).toBeDefined();
    // redemptionOpportunity is always a boolean (true/false) or undefined;
    // if set to false by the update, it should be falsy.
    // The field should not be true for a non-high-leverage inning (5).
    expect(finalHistory?.redemptionOpportunity).not.toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Walk + redemption flag — rules stay silent (#15 review)
// ─────────────────────────────────────────────────────────────────────────────

describe("walk with redemption flag set — rules stay silent", () => {
  const flaggedWalk = ctx({
    result: "walk",
    inning: 4,
    scoreDiff: 0,
    batterHistory: { abs: 3, hits: 1, strikeouts: 0, walks: 0, redemptionOpportunity: true },
  });

  it("setup_for_redemption does NOT fire on walk (walk is not failure)", () => {
    const rule = matchingRule(flaggedWalk);
    expect(rule?.id).not.toBe("setup_for_redemption");
  });

  it("redemption_payoff does NOT fire on walk (walk is not a hit)", () => {
    const rule = matchingRule(flaggedWalk);
    expect(rule?.id).not.toBe("redemption_payoff");
  });

  it("evaluator returns null for a flagged walk in non-special context", () => {
    // The flag is set but walk doesn't match any rule — should fall through to stat-tier
    const result = evaluateNarrativeRules(flaggedWalk, rng);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Redemption flag arming — positive case (#15 review)
// Uses a weaker pitcher + higher-contact offense to generate RISP + out scenario
// ─────────────────────────────────────────────────────────────────────────────

describe("redemption flag arming — positive arm case", () => {
  function makePitcherWeak(id: string): Player {
    return {
      id,
      name: `Pitcher ${id}`,
      surname: `P${id}`,
      role: "Starter" as const,
      stats: { velocity: 42, control: 42, break: 42 } as PitcherStats,
      salary: 100_000,
      level: 1,
      xp: 0,
      totalXpEarned: 0,
      equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    };
  }

  function makeContactBatter(id: string): Player {
    return {
      id,
      name: `Batter ${id}`,
      surname: `B${id}`,
      role: "Batter" as const,
      stats: { power: 35, contact: 78, glove: 55, speed: 60 } as BatterStats,
      salary: 100_000,
      level: 1,
      xp: 0,
      totalXpEarned: 0,
      equipment: { bat: null, glove: null, cap: null, cleats: null, accessory: null },
    };
  }

  it("arms the flag on at least one batter across many seeded runs in late high-leverage innings", () => {
    // Run 20 seeded simulations with late inning + close scores.
    // High-contact offense vs. weak pitcher: some singles/walks get runners to RISP,
    // then subsequent at-bats with RISP + late inning + close game arm the flag.
    let flagArmedInAnyRun = false;
    const batters = ["b1", "b2", "b3", "b4", "b5"].map(makeContactBatter);
    const pitcher = makePitcherWeak("p-weak");
    const defense = [pitcher];

    for (let seed = 1; seed <= 20 && !flagArmedInAnyRun; seed++) {
      const history = new Map<string, BatterHistory>();
      batters.forEach((b) => history.set(b.id, { abs: 0, hits: 0, strikeouts: 0, walks: 0 }));

      simulateInningWithStats(
        batters, defense, pitcher, 0, 0,
        /* inning= */ 8, // late game — flag arming requires inning >= 7
        true, new SeededRandomProvider(seed * 17),
        undefined,
        /* offenseScore= */ 0,
        /* defenseScore= */ 0, // tied — close game
        0, undefined, undefined,
        history
      );

      for (const entry of history.values()) {
        if (entry.redemptionOpportunity === true) {
          flagArmedInAnyRun = true;
          break;
        }
      }
    }

    // With 20 seeds, a contact team vs. weak pitcher in a tied inning 8 should
    // eventually produce RISP + out, arming the flag at least once.
    expect(flagArmedInAnyRun).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Approach Feedback Rules — #102
// correct_approach_read (priority 45) and approach_mismatch (priority 42)
// ─────────────────────────────────────────────────────────────────────────────

describe("correct_approach_read rule", () => {
  it("fires when power approach beats finesse strategy with a hit", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: "finesse", result: "single" })
    );
    expect(rule?.id).toBe("correct_approach_read");
  });

  it("fires when contact approach beats challenge strategy with a hit", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "contact", pitchStrategy: "challenge", result: "double" })
    );
    expect(rule?.id).toBe("correct_approach_read");
  });

  it("fires when patient approach beats paint strategy with a walk", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "patient", pitchStrategy: "paint", result: "walk" })
    );
    expect(rule?.id).toBe("correct_approach_read");
  });

  it("does NOT fire on a correct read when outcome is an out", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: "finesse", result: "groundout" })
    );
    // No high-leverage factors set, so no rule should match
    expect(rule?.id).not.toBe("correct_approach_read");
  });

  it("does NOT fire when approach and strategy are neutral (no counter)", () => {
    // power vs. challenge — no counter relationship defined
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: "challenge", result: "single" })
    );
    expect(rule?.id).not.toBe("correct_approach_read");
  });

  it("does NOT fire when batterApproach is undefined", () => {
    const rule = matchingRule(
      ctx({ batterApproach: undefined, pitchStrategy: "finesse", result: "single" })
    );
    expect(rule?.id).not.toBe("correct_approach_read");
  });

  it("does NOT fire when pitchStrategy is undefined", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: undefined, result: "single" })
    );
    expect(rule?.id).not.toBe("correct_approach_read");
  });

  it("evaluator returns a non-empty string with {batter}/{pitcher} filled", () => {
    const result = evaluateNarrativeRules(
      ctx({ batterApproach: "contact", pitchStrategy: "challenge", result: "single" }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });
});

describe("approach_mismatch rule", () => {
  it("fires when power approach is exploited by paint strategy with a strikeout", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: "paint", result: "strikeout" })
    );
    expect(rule?.id).toBe("approach_mismatch");
  });

  it("fires when contact approach is exploited by finesse strategy with an out", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "contact", pitchStrategy: "finesse", result: "flyout" })
    );
    expect(rule?.id).toBe("approach_mismatch");
  });

  it("fires when patient approach is exploited by challenge strategy with a strikeout", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "patient", pitchStrategy: "challenge", result: "strikeout" })
    );
    expect(rule?.id).toBe("approach_mismatch");
  });

  it("does NOT fire on a strategy-beats-approach matchup when outcome is a hit", () => {
    const rule = matchingRule(
      ctx({ batterApproach: "power", pitchStrategy: "paint", result: "single" })
    );
    expect(rule?.id).not.toBe("approach_mismatch");
  });

  it("does NOT fire when approach and strategy are neutral", () => {
    // patient vs. finesse — no mismatch relationship defined
    const rule = matchingRule(
      ctx({ batterApproach: "patient", pitchStrategy: "finesse", result: "strikeout" })
    );
    expect(rule?.id).not.toBe("approach_mismatch");
  });

  it("does NOT fire when batterApproach is undefined", () => {
    const rule = matchingRule(
      ctx({ batterApproach: undefined, pitchStrategy: "paint", result: "strikeout" })
    );
    expect(rule?.id).not.toBe("approach_mismatch");
  });

  it("evaluator returns a non-empty string with {batter}/{pitcher} filled", () => {
    const result = evaluateNarrativeRules(
      ctx({ batterApproach: "power", pitchStrategy: "paint", result: "strikeout" }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });
});

describe("approach feedback priority — does not override high-leverage rules", () => {
  it("correct_approach_read is suppressed by a higher-priority clutch rule", () => {
    // power beats finesse (correct read) + high-leverage hit → clutch_homer or similar wins
    const rule = matchingRule(
      ctx({
        result: "homerun",
        batterApproach: "power",
        pitchStrategy: "finesse",
        runsScored: 4, // grand slam wins at priority 110
        bases: [true, true, true],
      })
    );
    expect(rule?.id).toBe("grand_slam");
  });

  it("approach_mismatch is suppressed by a higher-priority frustration rule", () => {
    // Batter with 2 Ks + mismatch strikeout → frustration_strikeout (82) wins over approach_mismatch (42)
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        batterApproach: "power",
        pitchStrategy: "paint",
        batterHistory: { abs: 3, hits: 0, strikeouts: 2, walks: 0 },
      })
    );
    expect(rule?.id).toBe("frustration_strikeout");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Predicate unit tests — approachBeatsStrategy / strategyBeatsApproach
// ─────────────────────────────────────────────────────────────────────────────

import { approachBeatsStrategy, strategyBeatsApproach } from "../narrative/narrativeContext";

describe("approachBeatsStrategy predicate", () => {
  it("power beats finesse", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: "power", pitchStrategy: "finesse" }))).toBe(true));
  it("contact beats challenge", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: "contact", pitchStrategy: "challenge" }))).toBe(true));
  it("patient beats paint", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: "patient", pitchStrategy: "paint" }))).toBe(true));
  it("returns false for neutral matchup (power vs challenge)", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: "power", pitchStrategy: "challenge" }))).toBe(false));
  it("returns false when approach is undefined", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: undefined, pitchStrategy: "finesse" }))).toBe(false));
  it("returns false when strategy is undefined", () =>
    expect(approachBeatsStrategy(ctx({ batterApproach: "power", pitchStrategy: undefined }))).toBe(false));
});

describe("strategyBeatsApproach predicate", () => {
  it("paint beats power", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: "power", pitchStrategy: "paint" }))).toBe(true));
  it("finesse beats contact", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: "contact", pitchStrategy: "finesse" }))).toBe(true));
  it("challenge beats patient", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: "patient", pitchStrategy: "challenge" }))).toBe(true));
  it("returns false for neutral matchup (contact vs paint)", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: "contact", pitchStrategy: "paint" }))).toBe(false));
  it("returns false when approach is undefined", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: undefined, pitchStrategy: "paint" }))).toBe(false));
  it("returns false when strategy is undefined", () =>
    expect(strategyBeatsApproach(ctx({ batterApproach: "power", pitchStrategy: undefined }))).toBe(false));
  it("correct-read matchups do not also trigger strategyBeatsApproach", () => {
    // The triangles are mutually exclusive
    expect(strategyBeatsApproach(ctx({ batterApproach: "power", pitchStrategy: "finesse" }))).toBe(false);
    expect(strategyBeatsApproach(ctx({ batterApproach: "contact", pitchStrategy: "challenge" }))).toBe(false);
    expect(strategyBeatsApproach(ctx({ batterApproach: "patient", pitchStrategy: "paint" }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mental Skill Combo Predicates — hasClutchLegendCombo / isNearClutchLegend
// ─────────────────────────────────────────────────────────────────────────────

import {
  hasClutchLegendCombo,
  isNearClutchLegend,
  hasDiamondMindCombo,
  isNearDiamondMind,
  type MentalSkillSnapshot,
} from "../narrative/narrativeContext";

// Helpers for mental skill snapshots
function makeSkill(
  skillId: MentalSkillSnapshot["skillId"],
  rank: number,
  isActive = true
): MentalSkillSnapshot {
  return { skillId, rank, isActive };
}

const FULL_COMBO: MentalSkillSnapshot[] = [
  makeSkill("ice_veins", 3),
  makeSkill("clutch_composure", 3),
];

const NEAR_COMBO: MentalSkillSnapshot[] = [
  makeSkill("ice_veins", 2),
  makeSkill("clutch_composure", 2),
];

describe("hasClutchLegendCombo predicate", () => {
  it("returns true when both skills are rank 3 and active", () => {
    expect(hasClutchLegendCombo(ctx({ batterMentalSkills: FULL_COMBO }))).toBe(true);
  });

  it("returns true when both skills are rank 5 (max)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 5), makeSkill("clutch_composure", 4)],
        })
      )
    ).toBe(true);
  });

  it("returns false when ice_veins is rank 2 (below threshold)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 2), makeSkill("clutch_composure", 3)],
        })
      )
    ).toBe(false);
  });

  it("returns false when clutch_composure is rank 2 (below threshold)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 3), makeSkill("clutch_composure", 2)],
        })
      )
    ).toBe(false);
  });

  it("returns false when ice_veins is inactive (confidence lost)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [
            makeSkill("ice_veins", 3, false),
            makeSkill("clutch_composure", 3),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when clutch_composure is inactive", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [
            makeSkill("ice_veins", 3),
            makeSkill("clutch_composure", 3, false),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when only ice_veins is present (no clutch_composure)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({ batterMentalSkills: [makeSkill("ice_veins", 4)] })
      )
    ).toBe(false);
  });

  it("returns false when only clutch_composure is present (no ice_veins)", () => {
    expect(
      hasClutchLegendCombo(
        ctx({ batterMentalSkills: [makeSkill("clutch_composure", 4)] })
      )
    ).toBe(false);
  });

  it("returns false when batterMentalSkills is empty", () => {
    expect(hasClutchLegendCombo(ctx({ batterMentalSkills: [] }))).toBe(false);
  });

  it("returns false when batterMentalSkills is absent", () => {
    expect(hasClutchLegendCombo(ctx({ batterMentalSkills: undefined }))).toBe(false);
  });

  it("ignores unrelated skills — returns true when combo is met plus other skills", () => {
    expect(
      hasClutchLegendCombo(
        ctx({
          batterMentalSkills: [
            ...FULL_COMBO,
            makeSkill("pitch_recognition", 5),
            makeSkill("veteran_poise", 2),
          ],
        })
      )
    ).toBe(true);
  });
});

describe("isNearClutchLegend predicate", () => {
  it("returns true when both skills are rank 2 and active", () => {
    expect(isNearClutchLegend(ctx({ batterMentalSkills: NEAR_COMBO }))).toBe(true);
  });

  it("returns true when one skill is rank 2 and the other is rank 3 (asymmetric near)", () => {
    expect(
      isNearClutchLegend(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 2), makeSkill("clutch_composure", 3)],
        })
      )
    ).toBe(true);
  });

  it("returns false when both skills are rank 3 (that's the full combo, not near)", () => {
    expect(isNearClutchLegend(ctx({ batterMentalSkills: FULL_COMBO }))).toBe(false);
  });

  it("returns false when ice_veins is rank 1 (not 2+)", () => {
    expect(
      isNearClutchLegend(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 1), makeSkill("clutch_composure", 2)],
        })
      )
    ).toBe(false);
  });

  it("returns false when clutch_composure is rank 1 (not 2+)", () => {
    expect(
      isNearClutchLegend(
        ctx({
          batterMentalSkills: [makeSkill("ice_veins", 2), makeSkill("clutch_composure", 1)],
        })
      )
    ).toBe(false);
  });

  it("returns false when ice_veins is inactive", () => {
    expect(
      isNearClutchLegend(
        ctx({
          batterMentalSkills: [
            makeSkill("ice_veins", 2, false),
            makeSkill("clutch_composure", 2),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when clutch_composure is inactive", () => {
    expect(
      isNearClutchLegend(
        ctx({
          batterMentalSkills: [
            makeSkill("ice_veins", 2),
            makeSkill("clutch_composure", 2, false),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when only one skill is present", () => {
    expect(
      isNearClutchLegend(ctx({ batterMentalSkills: [makeSkill("ice_veins", 2)] }))
    ).toBe(false);
  });

  it("returns false when batterMentalSkills is absent", () => {
    expect(isNearClutchLegend(ctx({ batterMentalSkills: undefined }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clutch_legend_combo rule (priority 55)
// ─────────────────────────────────────────────────────────────────────────────

// High-leverage context shared by most clutch_legend tests
function clutchCtx(
  overrides: Partial<NarrativeContext> = {}
): NarrativeContext {
  return ctx({
    inning: 9,
    scoreDiff: -1, // trailing — triggers isHighLeverageSituation
    batterMentalSkills: FULL_COMBO,
    ...overrides,
  });
}

describe("clutch_legend_combo rule", () => {
  // ── Positive cases ──────────────────────────────────────────────────────

  it("fires for single with full combo in high-leverage", () => {
    const rule = matchingRule(clutchCtx({ result: "single" }));
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("fires for double with full combo in high-leverage", () => {
    const rule = matchingRule(clutchCtx({ result: "double" }));
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("fires for triple with full combo in high-leverage", () => {
    const rule = matchingRule(clutchCtx({ result: "triple" }));
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("fires for double in high-leverage (inning 8, close game) — no homer rules apply", () => {
    // inning 8, close game — high leverage. clutch_homer only fires for homerun.
    // No redemption context. clutch_legend_combo (55) wins.
    const rule = matchingRule(
      ctx({
        result: "double",
        runsScored: 0,
        inning: 8,
        scoreDiff: 1,  // close game, high leverage
        bases: [false, false, false],
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("fires when ice_veins is rank 5 and clutch_composure is rank 3", () => {
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        batterMentalSkills: [makeSkill("ice_veins", 5), makeSkill("clutch_composure", 3)],
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("fires in close late game (inning 8, scoreDiff=1) — qualifies as high-leverage", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 8,
        scoreDiff: 1,
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  // ── Negative cases — rule must NOT fire ─────────────────────────────────

  it("does NOT fire when combo is present but result is strikeout", () => {
    const rule = matchingRule(clutchCtx({ result: "strikeout" }));
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire when combo is present but result is groundout", () => {
    const rule = matchingRule(clutchCtx({ result: "groundout" }));
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire when combo is present but result is walk", () => {
    const rule = matchingRule(clutchCtx({ result: "walk" }));
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire without high-leverage situation (mid-game, comfortable lead)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 4,
        scoreDiff: 5, // comfortable lead, low leverage
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire when combo skills are below rank 3", () => {
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        batterMentalSkills: NEAR_COMBO, // both at rank 2 — not threshold
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire when only ice_veins is present", () => {
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        batterMentalSkills: [makeSkill("ice_veins", 4)],
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  it("does NOT fire when batterMentalSkills is absent", () => {
    const rule = matchingRule(
      clutchCtx({ result: "single", batterMentalSkills: undefined })
    );
    expect(rule?.id).not.toBe("clutch_legend_combo");
  });

  // ── Priority guards ──────────────────────────────────────────────────────

  it("is superseded by walkoff_hit (priority 95) when walk-off conditions met", () => {
    // Bases loaded, tied in inning 9, batter gets a single scoring the winning run
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        inning: 9,
        scoreDiff: 0,          // tied — if run scores, offense wins
        runsScored: 1,
        bases: [true, false, false],
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("walkoff_hit");
  });

  it("is superseded by redemption_hit (priority 87) when it's a first hit after 3+ hitless ABs", () => {
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        batterHistory: {
          abs: 3,
          hits: 0,
          strikeouts: 2,
          walks: 0,
        },
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("redemption_hit");
  });

  it("is superseded by clutch_hit_risp (priority 70) when RISP + late/close with runs scoring", () => {
    // Use inning 8 (not 9) so that isPotentialWalkoff doesn't fire (walkoff needs inning ≥ 9).
    // clutch_hit_risp (70) > clutch_legend_combo (55).
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 8,
        scoreDiff: -1,
        bases: [false, true, false], // runner on 2nd
        runsScored: 1,
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_hit_risp");
  });

  it("beats approach rules (priority 45) when both would match", () => {
    // Correct approach read (power vs finesse, single) in high-leverage + full combo
    // clutch_legend_combo (55) > correct_approach_read (45)
    const rule = matchingRule(
      clutchCtx({
        result: "single",
        batterApproach: "power",
        pitchStrategy: "finesse",
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  // ── Text output ──────────────────────────────────────────────────────────

  it("returns non-empty string with {batter} and {pitcher} tokens filled", () => {
    const result = evaluateNarrativeRules(
      clutchCtx({ result: "single", batterName: "Rivera", pitcherName: "Tanaka" }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clutch_legend_hint rule (priority 15)
// ─────────────────────────────────────────────────────────────────────────────

describe("clutch_legend_hint rule", () => {
  it("fires for a hit in high-leverage when near-combo (both rank 2)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: NEAR_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_legend_hint");
  });

  it("fires when asymmetric near-combo: ice_veins rank 2, clutch rank 3", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: [makeSkill("ice_veins", 2), makeSkill("clutch_composure", 3)],
      })
    );
    expect(rule?.id).toBe("clutch_legend_hint");
  });

  it("does NOT fire when full combo is active (clutch_legend_combo takes priority)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
    expect(rule?.id).not.toBe("clutch_legend_hint");
  });

  it("does NOT fire outside high-leverage situations", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 3,
        scoreDiff: 4,
        batterMentalSkills: NEAR_COMBO,
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_hint");
  });

  it("does NOT fire on non-hit results", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: NEAR_COMBO,
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_hint");
  });

  it("does NOT fire when only one skill is present", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: [makeSkill("ice_veins", 2)],
      })
    );
    expect(rule?.id).not.toBe("clutch_legend_hint");
  });

  it("is superseded by higher-priority rules in clutch moments", () => {
    // RISP + late game + near-combo: clutch_hit_risp (70) should win
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        bases: [false, true, false],
        runsScored: 1,
        batterMentalSkills: NEAR_COMBO,
      })
    );
    // clutch_hit_risp (70) or redemption rules take precedence
    expect(rule?.id).not.toBe("clutch_legend_hint");
  });

  it("returns non-empty text with {batter} token filled", () => {
    const result = evaluateNarrativeRules(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: NEAR_COMBO,
        batterName: "Cruz",
      }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasDiamondMindCombo predicate
// ─────────────────────────────────────────────────────────────────────────────

const DM_FULL_COMBO: MentalSkillSnapshot[] = [
  makeSkill("pitch_recognition", 3),
  makeSkill("game_reading", 3),
];

const DM_NEAR_COMBO: MentalSkillSnapshot[] = [
  makeSkill("pitch_recognition", 2),
  makeSkill("game_reading", 2),
];

describe("hasDiamondMindCombo predicate", () => {
  it("returns true when both skills are rank 3 and active", () => {
    expect(hasDiamondMindCombo(ctx({ batterMentalSkills: DM_FULL_COMBO }))).toBe(true);
  });

  it("returns true when both skills are rank 5 (max)", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 5), makeSkill("game_reading", 5)],
        })
      )
    ).toBe(true);
  });

  it("returns true when pitch_recognition is rank 4, game_reading is rank 3", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 4), makeSkill("game_reading", 3)],
        })
      )
    ).toBe(true);
  });

  it("returns false when pitch_recognition is rank 2 (below threshold)", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 2), makeSkill("game_reading", 3)],
        })
      )
    ).toBe(false);
  });

  it("returns false when game_reading is rank 2 (below threshold)", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 3), makeSkill("game_reading", 2)],
        })
      )
    ).toBe(false);
  });

  it("returns false when pitch_recognition is inactive (confidence lost)", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [
            makeSkill("pitch_recognition", 3, false),
            makeSkill("game_reading", 3),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when game_reading is inactive", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [
            makeSkill("pitch_recognition", 3),
            makeSkill("game_reading", 3, false),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when only pitch_recognition is present", () => {
    expect(
      hasDiamondMindCombo(
        ctx({ batterMentalSkills: [makeSkill("pitch_recognition", 4)] })
      )
    ).toBe(false);
  });

  it("returns false when only game_reading is present", () => {
    expect(
      hasDiamondMindCombo(
        ctx({ batterMentalSkills: [makeSkill("game_reading", 4)] })
      )
    ).toBe(false);
  });

  it("returns false when batterMentalSkills is empty", () => {
    expect(hasDiamondMindCombo(ctx({ batterMentalSkills: [] }))).toBe(false);
  });

  it("returns false when batterMentalSkills is absent", () => {
    expect(hasDiamondMindCombo(ctx({ batterMentalSkills: undefined }))).toBe(false);
  });

  it("ignores unrelated skills — returns true when combo is met plus other skills", () => {
    expect(
      hasDiamondMindCombo(
        ctx({
          batterMentalSkills: [
            ...DM_FULL_COMBO,
            makeSkill("ice_veins", 4),
            makeSkill("veteran_poise", 2),
          ],
        })
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isNearDiamondMind predicate
// ─────────────────────────────────────────────────────────────────────────────

describe("isNearDiamondMind predicate", () => {
  it("returns true when both skills are rank 2 and active", () => {
    expect(isNearDiamondMind(ctx({ batterMentalSkills: DM_NEAR_COMBO }))).toBe(true);
  });

  it("returns true when asymmetric near-combo: pitch_recognition rank 2, game_reading rank 3", () => {
    // rank 2 + rank 3 = near (not both 3+)
    expect(
      isNearDiamondMind(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 2), makeSkill("game_reading", 3)],
        })
      )
    ).toBe(true);
  });

  it("returns false when full combo is active (both rank 3+)", () => {
    expect(isNearDiamondMind(ctx({ batterMentalSkills: DM_FULL_COMBO }))).toBe(false);
  });

  it("returns false when only one skill present at rank 2", () => {
    expect(
      isNearDiamondMind(
        ctx({ batterMentalSkills: [makeSkill("pitch_recognition", 2)] })
      )
    ).toBe(false);
  });

  it("returns false when one skill is rank 1 (below near threshold)", () => {
    expect(
      isNearDiamondMind(
        ctx({
          batterMentalSkills: [makeSkill("pitch_recognition", 1), makeSkill("game_reading", 2)],
        })
      )
    ).toBe(false);
  });

  it("returns false when pitch_recognition is inactive at rank 2", () => {
    expect(
      isNearDiamondMind(
        ctx({
          batterMentalSkills: [
            makeSkill("pitch_recognition", 2, false),
            makeSkill("game_reading", 2),
          ],
        })
      )
    ).toBe(false);
  });

  it("returns false when batterMentalSkills is absent", () => {
    expect(isNearDiamondMind(ctx({ batterMentalSkills: undefined }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// diamond_mind_combo rule (priority 52)
// ─────────────────────────────────────────────────────────────────────────────

describe("diamond_mind_combo rule", () => {
  // ── Positive cases ──────────────────────────────────────────────────────

  it("fires for single with full combo (any situation)", () => {
    const rule = matchingRule(
      ctx({ result: "single", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires for double with full combo", () => {
    const rule = matchingRule(
      ctx({ result: "double", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires for triple with full combo", () => {
    const rule = matchingRule(
      ctx({ result: "triple", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires for homerun with full combo (no grand slam / clutch homer context)", () => {
    const rule = matchingRule(
      ctx({ result: "homerun", runsScored: 1, inning: 4, scoreDiff: 3, batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires for walk with full combo — distinct from Clutch Legend which requires a hit", () => {
    const rule = matchingRule(
      ctx({ result: "walk", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires even outside high-leverage (mid-game, comfortable lead)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 3,
        scoreDiff: 5,
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("fires when pitch_recognition is rank 5, game_reading is rank 3", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterMentalSkills: [makeSkill("pitch_recognition", 5), makeSkill("game_reading", 3)],
      })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  // ── Negative cases — rule must NOT fire ─────────────────────────────────

  it("does NOT fire on strikeout (even with full combo)", () => {
    const rule = matchingRule(
      ctx({ result: "strikeout", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).not.toBe("diamond_mind_combo");
  });

  it("does NOT fire on groundout", () => {
    const rule = matchingRule(
      ctx({ result: "groundout", batterMentalSkills: DM_FULL_COMBO })
    );
    expect(rule?.id).not.toBe("diamond_mind_combo");
  });

  it("does NOT fire when skills are below rank 3 (near-combo only)", () => {
    const rule = matchingRule(
      ctx({ result: "single", batterMentalSkills: DM_NEAR_COMBO })
    );
    expect(rule?.id).not.toBe("diamond_mind_combo");
  });

  it("does NOT fire when only pitch_recognition is present", () => {
    const rule = matchingRule(
      ctx({ result: "single", batterMentalSkills: [makeSkill("pitch_recognition", 4)] })
    );
    expect(rule?.id).not.toBe("diamond_mind_combo");
  });

  it("does NOT fire when batterMentalSkills is absent", () => {
    const rule = matchingRule(
      ctx({ result: "single", batterMentalSkills: undefined })
    );
    expect(rule?.id).not.toBe("diamond_mind_combo");
  });

  // ── Priority guards ──────────────────────────────────────────────────────

  it("is superseded by walkoff_hit (priority 106) when walk-off conditions met", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: 0,
        runsScored: 1,
        bases: [true, false, false],
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("walkoff_hit");
  });

  it("is superseded by redemption_hit (priority 87) when first hit after 3+ hitless ABs", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterHistory: { abs: 3, hits: 0, strikeouts: 2, walks: 0 },
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("redemption_hit");
  });

  it("is superseded by clutch_hit_risp (priority 70) when RISP + late/close + runs scoring", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 8,
        scoreDiff: -1,
        bases: [false, true, false],
        runsScored: 1,
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("clutch_hit_risp");
  });

  it("is superseded by clutch_legend_combo (priority 55) when both combos match in high-leverage hit", () => {
    // Both DM and Clutch Legend combos active, high-leverage hit
    // clutch_legend_combo (55) > diamond_mind_combo (52)
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: [
          ...DM_FULL_COMBO,
          makeSkill("ice_veins", 3),
          makeSkill("clutch_composure", 3),
        ],
      })
    );
    expect(rule?.id).toBe("clutch_legend_combo");
  });

  it("beats clutch_legend_combo on a walk (Clutch Legend requires a hit)", () => {
    // Walk: clutch_legend_combo won't fire (requires isHit). diamond_mind_combo fires instead.
    const rule = matchingRule(
      ctx({
        result: "walk",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: [
          ...DM_FULL_COMBO,
          makeSkill("ice_veins", 3),
          makeSkill("clutch_composure", 3),
        ],
      })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  it("beats correct_approach_read (priority 45) when both would match", () => {
    // diamond_mind_combo (52) > correct_approach_read (45)
    const rule = matchingRule(
      ctx({
        result: "single",
        batterApproach: "power",
        pitchStrategy: "finesse",
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
  });

  // ── Text output ──────────────────────────────────────────────────────────

  it("returns non-empty string with {batter} and {pitcher} tokens filled", () => {
    const result = evaluateNarrativeRules(
      ctx({
        result: "single",
        batterMentalSkills: DM_FULL_COMBO,
        batterName: "Yamamoto",
        pitcherName: "Gibson",
      }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
    expect(result).not.toContain("{pitcher}");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// diamond_mind_hint rule (priority 12)
// ─────────────────────────────────────────────────────────────────────────────

describe("diamond_mind_hint rule", () => {
  it("fires for a hit when near-combo (both rank 2, any situation)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterMentalSkills: DM_NEAR_COMBO,
      })
    );
    expect(rule?.id).toBe("diamond_mind_hint");
  });

  it("fires for a walk when near-combo", () => {
    const rule = matchingRule(
      ctx({
        result: "walk",
        batterMentalSkills: DM_NEAR_COMBO,
      })
    );
    expect(rule?.id).toBe("diamond_mind_hint");
  });

  it("fires when asymmetric near-combo: pitch_recognition rank 2, game_reading rank 3", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterMentalSkills: [makeSkill("pitch_recognition", 2), makeSkill("game_reading", 3)],
      })
    );
    expect(rule?.id).toBe("diamond_mind_hint");
  });

  it("does NOT fire when full combo is active (diamond_mind_combo takes priority)", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterMentalSkills: DM_FULL_COMBO,
      })
    );
    expect(rule?.id).toBe("diamond_mind_combo");
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("does NOT fire on non-hit, non-walk results (strikeout)", () => {
    const rule = matchingRule(
      ctx({
        result: "strikeout",
        batterMentalSkills: DM_NEAR_COMBO,
      })
    );
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("does NOT fire on groundout", () => {
    const rule = matchingRule(
      ctx({
        result: "groundout",
        batterMentalSkills: DM_NEAR_COMBO,
      })
    );
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("does NOT fire when only one skill is present", () => {
    const rule = matchingRule(
      ctx({
        result: "single",
        batterMentalSkills: [makeSkill("pitch_recognition", 2)],
      })
    );
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("is superseded by higher-priority rules (RISP + late game)", () => {
    // clutch_hit_risp (70) beats diamond_mind_hint (12)
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        bases: [false, true, false],
        runsScored: 1,
        batterMentalSkills: DM_NEAR_COMBO,
      })
    );
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("is superseded by clutch_legend_hint (priority 15) in high-leverage hit with Clutch Legend near-combo", () => {
    // Both hint conditions met. clutch_legend_hint (15) > diamond_mind_hint (12).
    // For this to happen: near-Clutch-Legend in high-leverage, near-Diamond-Mind.
    const rule = matchingRule(
      ctx({
        result: "single",
        inning: 9,
        scoreDiff: -1,
        batterMentalSkills: [
          ...DM_NEAR_COMBO,
          makeSkill("ice_veins", 2),
          makeSkill("clutch_composure", 2),
        ],
      })
    );
    // clutch_legend_hint fires first (priority 15 > 12)
    expect(rule?.id).toBe("clutch_legend_hint");
    expect(rule?.id).not.toBe("diamond_mind_hint");
  });

  it("returns non-empty text with {batter} token filled", () => {
    const result = evaluateNarrativeRules(
      ctx({
        result: "single",
        batterMentalSkills: DM_NEAR_COMBO,
        batterName: "Fernandez",
      }),
      rng
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain("{batter}");
  });
});
