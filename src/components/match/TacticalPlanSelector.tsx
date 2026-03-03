/**
 * TacticalPlanSelector — situational between-inning strategy selector.
 *
 * Generates 2–3 context-aware "calls" instead of generic Contact/Power/Patient.
 * The call names and descriptions change based on actual game state so decisions
 * feel grounded in the moment.
 *
 * ─── HOW TO ADD NEW CALLS ────────────────────────────────────────────────────
 * Just append an entry to TACTICAL_POOL below. No logic changes needed.
 * Each entry has:
 *   - approach: maps to the underlying BatterApproach (power/contact/patient)
 *   - callName, icon, situation: display text
 *   - weight: how often this surfaces (higher = picks first when multiple eligible)
 *   - when: optional filter conditions (all must pass for the call to be eligible)
 *       minScoreDiff / maxScoreDiff  — scoreDiff = myRuns - opponentRuns
 *       minInning / maxInning        — inning number
 *       pitcherFatigueIs             — only when pitcher is one of these levels
 *       pitcherFatigueNot            — exclude when pitcher is one of these levels
 *
 * Selection picks the highest-weight eligible call per approach (power/contact/patient),
 * then returns the top 2 by weight. A pitcher-fatigue call gets added as a third slot
 * when the pitcher is tired/gassed and the base set doesn't already include patient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect } from "react";
import type { BatterApproach } from "@/types/approach";
import type { PitcherFatigueLevel } from "@/engine/interactiveMatchEngine";

// ─── Pool entry type ──────────────────────────────────────────────────────────

interface TacticalChoiceRule {
  approach:  BatterApproach;
  callName:  string;
  icon:      string;
  /** One-line description of why this call fits — should feel situationally relevant */
  situation: string;
  /**
   * Higher weight = picked first when multiple rules are eligible for the same approach.
   * Default: 1. Use 2+ for "most fitting" calls, 0.5 for fallbacks.
   */
  weight?: number;
  when?: {
    minScoreDiff?:      number;                // scoreDiff >= this
    maxScoreDiff?:      number;                // scoreDiff <= this
    minInning?:         number;                // inning >= this
    maxInning?:         number;                // inning <= this
    pitcherFatigueIs?:  PitcherFatigueLevel[];  // pitcher must be one of these
    pitcherFatigueNot?: PitcherFatigueLevel[];  // pitcher must NOT be one of these
  };
}

// ─── Tactical call pool ───────────────────────────────────────────────────────
// Add new calls here. Conditions are AND-ed. No other changes required.

const TACTICAL_POOL: TacticalChoiceRule[] = [

  // ── BIG DEFICIT (down 3+) ──────────────────────────────────────────────────
  {
    approach: "power", callName: "We Need a Big Inning", icon: "💥", weight: 3,
    situation: "Need multiple runs. Go hunting for extra bases — no playing it safe.",
    when: { maxScoreDiff: -3 },
  },
  {
    approach: "contact", callName: "Start a Rally", icon: "🏃", weight: 3,
    situation: "Get on base any way you can. Keep the line moving and let the run support come.",
    when: { maxScoreDiff: -3 },
  },
  {
    approach: "patient", callName: "Make Him Pay", icon: "⏳", weight: 2,
    situation: "He's up big and feeling it — make him throw strikes and wait for a mistake.",
    when: { maxScoreDiff: -3, pitcherFatigueNot: ["fresh"] },
  },

  // ── SMALL DEFICIT, LATE (down 1-2, inning 7+) ─────────────────────────────
  {
    approach: "power", callName: "One Big Swing", icon: "💪", weight: 3,
    situation: "A homer ties it or takes the lead. Stay patient, then punish your pitch.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, minInning: 7 },
  },
  {
    approach: "contact", callName: "Manufacture It", icon: "⚙️", weight: 3,
    situation: "Smart baseball. Get on base, move runners, find a way to scratch across a run.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, minInning: 7 },
  },
  {
    approach: "patient", callName: "Make Him Work", icon: "🔭", weight: 2,
    situation: "Run up his pitch count. A walk is as good as a hit right now.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, minInning: 7 },
  },

  // ── SMALL DEFICIT, EARLY (down 1-2, inning 1-6) ───────────────────────────
  {
    approach: "power", callName: "Answer Back", icon: "⚡", weight: 2,
    situation: "Don't let the deficit sit. Attack early in the count and take control.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, maxInning: 6 },
  },
  {
    approach: "contact", callName: "Get on Base", icon: "👟", weight: 2,
    situation: "Start building — put the ball in play and see what develops.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, maxInning: 6 },
  },
  {
    approach: "patient", callName: "Long Game", icon: "📖", weight: 1,
    situation: "Plenty of time. Make him work counts and scout his tendencies for later.",
    when: { minScoreDiff: -2, maxScoreDiff: -1, maxInning: 6 },
  },

  // ── TIED ──────────────────────────────────────────────────────────────────
  {
    approach: "power", callName: "Take the Lead", icon: "🎯", weight: 2,
    situation: "First to score in a tie game wins the momentum. Be aggressive with your pitch.",
    when: { minScoreDiff: 0, maxScoreDiff: 0 },
  },
  {
    approach: "contact", callName: "Play Your Game", icon: "🧠", weight: 2,
    situation: "Stay disciplined and make solid contact. Trust your lineup to come through.",
    when: { minScoreDiff: 0, maxScoreDiff: 0 },
  },
  {
    approach: "patient", callName: "Force His Hand", icon: "🃏", weight: 1,
    situation: "Work counts, get runners on, and let your lineup do the damage.",
    when: { minScoreDiff: 0, maxScoreDiff: 0 },
  },
  {
    approach: "power", callName: "Whoever Scores First Wins", icon: "⚔️", weight: 3,
    situation: "It's anyone's game. One big swing decides it — be ready.",
    when: { minScoreDiff: 0, maxScoreDiff: 0, minInning: 7 },
  },

  // ── SMALL LEAD, LATE (up 1-2, inning 7+) ─────────────────────────────────
  {
    approach: "contact", callName: "Protect the Lead", icon: "🛡️", weight: 3,
    situation: "Don't give away outs. Make him earn every single one.",
    when: { minScoreDiff: 1, maxScoreDiff: 2, minInning: 7 },
  },
  {
    approach: "power", callName: "Put It Away", icon: "🔒", weight: 3,
    situation: "Extend the lead and take the game completely out of their hands.",
    when: { minScoreDiff: 1, maxScoreDiff: 2, minInning: 7 },
  },
  {
    approach: "patient", callName: "Run the Clock", icon: "⏱️", weight: 2,
    situation: "Grind at-bats, tire out their bullpen. Every pitch they throw counts.",
    when: { minScoreDiff: 1, maxScoreDiff: 2, minInning: 7 },
  },

  // ── SMALL LEAD, EARLY (up 1-2, inning 1-6) ───────────────────────────────
  {
    approach: "power", callName: "Keep Scoring", icon: "🔥", weight: 2,
    situation: "Press the advantage while you have it. Don't let him settle in.",
    when: { minScoreDiff: 1, maxScoreDiff: 2, maxInning: 6 },
  },
  {
    approach: "contact", callName: "Stay Disciplined", icon: "🎯", weight: 2,
    situation: "Good at-bats protect the lead. Don't chase garbage — make him come to you.",
    when: { minScoreDiff: 1, maxScoreDiff: 2, maxInning: 6 },
  },

  // ── BIG LEAD (up 3+), LATE ────────────────────────────────────────────────
  {
    approach: "contact", callName: "Stay Focused", icon: "🧘", weight: 3,
    situation: "You've got this. Don't give them cheap outs or reasons to believe.",
    when: { minScoreDiff: 3, minInning: 7 },
  },
  {
    approach: "power", callName: "Bury It", icon: "⚰️", weight: 2,
    situation: "More runs = more comfortable. Be opportunistic when they hang one.",
    when: { minScoreDiff: 3, minInning: 7 },
  },

  // ── BIG LEAD (up 3+), EARLY ───────────────────────────────────────────────
  {
    approach: "power", callName: "Keep the Foot Down", icon: "👣", weight: 3,
    situation: "Don't coast. Keep putting runs on the board — leads disappear fast.",
    when: { minScoreDiff: 3, maxInning: 6 },
  },
  {
    approach: "contact", callName: "Play It Smart", icon: "🧢", weight: 2,
    situation: "Controlled aggression. Keep making good contact and let the runs come.",
    when: { minScoreDiff: 3, maxInning: 6 },
  },

  // ── PITCHER FATIGUE — added as third slot when eligible ───────────────────
  {
    approach: "patient", callName: "He's Done", icon: "💀", weight: 5,
    situation: "Running on empty — make him throw every pitch he has left. Bullpen's coming.",
    when: { pitcherFatigueIs: ["gassed"] },
  },
  {
    approach: "patient", callName: "He's Fading", icon: "😮‍💨", weight: 5,
    situation: "He's laboring through his pitch count. Make him work harder every at-bat.",
    when: { pitcherFatigueIs: ["tired"] },
  },

  // ── EXTRA INNINGS ─────────────────────────────────────────────────────────
  {
    approach: "contact", callName: "Just Score", icon: "🏁", weight: 4,
    situation: "Runner on second, one run wins it. Put the ball in play — no heroes needed.",
    when: { minScoreDiff: 0, maxScoreDiff: 0, minInning: 10 },
  },
  {
    approach: "power", callName: "End It Now", icon: "🎆", weight: 4,
    situation: "Walk-off is right there. One good swing and you're going home.",
    when: { minScoreDiff: 0, maxScoreDiff: 0, minInning: 10 },
  },

  // ── UNIVERSAL FALLBACKS (no conditions — always eligible) ─────────────────
  {
    approach: "power",   callName: "Be Aggressive",   icon: "⚡", weight: 0.5,
    situation: "Attack early in the count. Make something happen.",
  },
  {
    approach: "contact", callName: "Make Contact",    icon: "🏏", weight: 0.5,
    situation: "Put the ball in play. Swing at strikes, lay off the rest.",
  },
  {
    approach: "patient", callName: "Work the Count",  icon: "📊", weight: 0.5,
    situation: "Take pitches, draw walks, tire him out.",
  },
];

// ─── Selector logic ───────────────────────────────────────────────────────────

interface TacticalChoice {
  approach:  BatterApproach;
  callName:  string;
  icon:      string;
  situation: string;
  key:       string;
}

function filterEligible(
  rules: TacticalChoiceRule[],
  inning: number,
  scoreDiff: number,
  pitcherFatigue: PitcherFatigueLevel,
): TacticalChoiceRule[] {
  return rules.filter((r) => {
    const w = r.when ?? {};
    if (w.minScoreDiff      !== undefined && scoreDiff      < w.minScoreDiff)      return false;
    if (w.maxScoreDiff      !== undefined && scoreDiff      > w.maxScoreDiff)      return false;
    if (w.minInning         !== undefined && inning         < w.minInning)         return false;
    if (w.maxInning         !== undefined && inning         > w.maxInning)         return false;
    if (w.pitcherFatigueIs  && !w.pitcherFatigueIs.includes(pitcherFatigue))      return false;
    if (w.pitcherFatigueNot &&  w.pitcherFatigueNot.includes(pitcherFatigue))     return false;
    return true;
  });
}

function generateTacticalChoices(
  inning: number,
  scoreDiff: number,
  pitcherFatigue: PitcherFatigueLevel,
): TacticalChoice[] {
  const eligible = filterEligible(TACTICAL_POOL, inning, scoreDiff, pitcherFatigue);

  // Separate pitcher-fatigue-specific rules from regular rules
  const fatigueRules  = eligible.filter((r) => r.when?.pitcherFatigueIs !== undefined);
  const regularRules  = eligible.filter((r) => r.when?.pitcherFatigueIs === undefined);

  // Pick best rule per approach from regular pool (highest weight wins)
  const byApproach: Partial<Record<BatterApproach, TacticalChoiceRule>> = {};
  for (const rule of regularRules) {
    const existing = byApproach[rule.approach];
    if (!existing || (rule.weight ?? 1) > (existing.weight ?? 1)) {
      byApproach[rule.approach] = rule;
    }
  }

  // Sort by weight and pick top 2 for the base set
  const ranked = (Object.values(byApproach) as TacticalChoiceRule[])
    .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  const base = ranked.slice(0, 2);

  // Add pitcher fatigue option as third slot if relevant and not already patient
  const hasPatient = base.some((r) => r.approach === "patient");
  const fatigueOption =
    !hasPatient && pitcherFatigue !== "fresh" && fatigueRules.length > 0
      ? fatigueRules.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0]
      : null;

  const selected = fatigueOption ? [...base, fatigueOption] : base;

  return selected.map((rule, i) => ({
    approach:  rule.approach,
    callName:  rule.callName,
    icon:      rule.icon,
    situation: rule.situation,
    key:       String(i + 1),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TacticalPlanSelectorProps {
  inning:         number;
  myRuns:         number;
  opponentRuns:   number;
  pitcherFatigue: PitcherFatigueLevel;
  onSelectPlan:   (plan: BatterApproach) => void;
}

export function TacticalPlanSelector({
  inning,
  myRuns,
  opponentRuns,
  pitcherFatigue,
  onSelectPlan,
}: TacticalPlanSelectorProps) {
  const scoreDiff = myRuns - opponentRuns;
  const choices   = generateTacticalChoices(inning, scoreDiff, pitcherFatigue);

  const scoreLabel =
    scoreDiff === 0 ? "Tied"
    : scoreDiff > 0 ? `Up ${Math.abs(scoreDiff)}`
    : `Down ${Math.abs(scoreDiff)}`;

  // Keyboard shortcuts: 1 / 2 / 3
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const choice = choices.find((c) => c.key === e.key);
      if (choice) {
        e.preventDefault();
        onSelectPlan(choice.approach);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onSelectPlan]);

  return (
    <div className="h-full flex flex-col justify-center gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground uppercase tracking-widest">
          Your call
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {inning >= 10 ? `Extra ${inning}` : `Inning ${inning}`} · {scoreLabel} {myRuns}–{opponentRuns}
        </span>
      </div>

      {/* Choices */}
      <div className={`grid gap-2 ${choices.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {choices.map((choice) => (
          <button
            key={choice.key}
            onClick={() => onSelectPlan(choice.approach)}
            className="group flex flex-col gap-1.5 rounded-lg border border-border bg-card hover:bg-accent hover:border-foreground/20 transition-all duration-100 px-3 py-2.5 text-left"
          >
            {/* Icon + shortcut */}
            <div className="flex items-start justify-between">
              <span className="text-xl leading-none">{choice.icon}</span>
              <kbd className="text-[10px] font-mono opacity-40 bg-black/10 dark:bg-white/10 rounded px-1 py-px group-hover:opacity-70 transition-opacity">
                {choice.key}
              </kbd>
            </div>

            {/* Call name */}
            <span className="font-bold text-xs text-foreground leading-tight">
              {choice.callName}
            </span>

            {/* Situation description */}
            <span className="text-[11px] text-muted-foreground leading-snug">
              {choice.situation}
            </span>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <p className="text-[11px] text-muted-foreground leading-snug">
        Sets the default approach for auto-sim at-bats. You'll be asked directly in clutch moments.
      </p>
    </div>
  );
}
