/**
 * TacticalPlanSelector — replaces InningGamePlanSelector.
 *
 * Instead of three generic "Contact / Power / Patient" buttons that feel
 * disconnected from the game, this generates 2–3 situational "calls" that
 * are named and described based on the current game state:
 *   – score differential
 *   – inning number (early / mid / late / extra)
 *   – opponent pitcher's fatigue level
 *
 * Each call maps to one of the three underlying BatterApproach values so the
 * mechanics are unchanged — only the framing is situation-aware.
 */

import { useEffect } from "react";
import type { BatterApproach } from "@/types/approach";
import type { PitcherFatigueLevel } from "@/engine/interactiveMatchEngine";

interface TacticalChoice {
  approach: BatterApproach;
  callName: string;
  icon: string;
  situation: string;
  key: string;
}

// ─── Situational choice generation ────────────────────────────────────────────

function generateTacticalChoices(
  inning: number,
  scoreDiff: number,          // myRuns - opponentRuns
  pitcherFatigue: PitcherFatigueLevel,
): TacticalChoice[] {
  const isLate  = inning >= 7;
  const isEarly = inning <= 3;

  // Pitcher opportunity — patient option referencing fatigue when relevant
  const pitcherOption: Omit<TacticalChoice, "key"> | null =
    pitcherFatigue === "gassed"
      ? { approach: "patient", callName: "He's Done",   icon: "💀", situation: "Running on empty — make him throw every pitch he's got left. Bullpen's coming." }
      : pitcherFatigue === "tired"
      ? { approach: "patient", callName: "He's Fading", icon: "😮‍💨", situation: "He's laboring. Run up his pitch count and tire him out faster." }
      : null;

  // Base two choices from game situation
  type ChoiceBase = Omit<TacticalChoice, "key">;
  let base: [ChoiceBase, ChoiceBase];

  if (scoreDiff <= -3) {
    // Down big — need a crooked number
    base = [
      { approach: "power",   callName: "We Need a Big Inning", icon: "💥", situation: "Need multiple runs. Go hunting for extra bases — no playing it safe." },
      { approach: "contact", callName: "Start a Rally",        icon: "🏃", situation: "Get on base any way you can. Keep the line moving and let the run support come." },
    ];
  } else if (scoreDiff === -1 || scoreDiff === -2) {
    if (isLate) {
      // Down 1-2, late — specific, high-stakes framing
      base = [
        { approach: "power",   callName: "One Big Swing",    icon: "💪", situation: "A homer ties it or takes the lead. Stay patient, then punish your pitch." },
        { approach: "contact", callName: "Manufacture It",   icon: "⚙️", situation: "Smart baseball. Get on base, move runners, find a way to scratch across a run." },
      ];
    } else {
      // Down 1-2, early — less urgent, build-oriented
      base = [
        { approach: "power",   callName: "Answer Back",   icon: "⚡", situation: "Don't let the deficit sit. Attack early in the count and take control." },
        { approach: "contact", callName: "Get on Base",   icon: "👟", situation: "Start building — put the ball in play and see what develops." },
      ];
    }
  } else if (scoreDiff === 0) {
    // Tied
    base = [
      { approach: "power",   callName: "Take the Lead",   icon: "🎯", situation: "First to score in a tie game wins the momentum. Be aggressive with your pitch." },
      { approach: "contact", callName: "Play Your Game",  icon: "🧠", situation: "Stay disciplined and make solid contact. Trust your lineup to come through." },
    ];
  } else if (scoreDiff <= 2) {
    if (isLate) {
      // Up 1-2, late — protect it
      base = [
        { approach: "contact", callName: "Protect the Lead", icon: "🛡️", situation: "Don't give away outs. Make him earn every single one." },
        { approach: "power",   callName: "Put It Away",      icon: "🔒", situation: "Extend the lead and take the game out of their hands." },
      ];
    } else {
      // Up 1-2, early — keep pressing
      base = [
        { approach: "power",   callName: "Keep Scoring",      icon: "🔥", situation: "Press the advantage while you have it. Don't let him settle in." },
        { approach: "contact", callName: "Stay Disciplined",  icon: "🎯", situation: "Good at-bats protect the lead. Don't swing at garbage." },
      ];
    }
  } else if (isEarly) {
    // Up big, early game — don't rest
    base = [
      { approach: "power",   callName: "Keep the Foot Down", icon: "👣", situation: "Don't coast. Keep putting runs on the board — leads disappear fast." },
      { approach: "contact", callName: "Play It Smart",      icon: "🧢", situation: "Controlled aggression. Keep making good contact and let the runs come." },
    ];
  } else {
    // Up big, mid/late — comfortable but focused
    base = [
      { approach: "contact", callName: "Stay Focused",      icon: "🧘", situation: "You've got this. Don't give them cheap outs or reasons to believe." },
      { approach: "power",   callName: "Bury It",           icon: "⚰️", situation: "More runs = more comfortable. Be opportunistic when they hang one." },
    ];
  }

  // Assign shortcut keys for base choices
  const choices: TacticalChoice[] = base.map((b, i) => ({ ...b, key: String(i + 1) }));

  // Add pitcher fatigue option as third choice when relevant and not already patient
  if (pitcherOption && pitcherFatigue !== "fresh") {
    const alreadyHasPatient = choices.some((c) => c.approach === "patient");
    if (!alreadyHasPatient) {
      choices.push({ ...pitcherOption, key: "3" });
    }
  }

  return choices;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TacticalPlanSelectorProps {
  inning: number;
  myRuns: number;
  opponentRuns: number;
  pitcherFatigue: PitcherFatigueLevel;
  onSelectPlan: (plan: BatterApproach) => void;
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
    scoreDiff === 0   ? "Tied"
    : scoreDiff > 0   ? `Up ${Math.abs(scoreDiff)}`
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
          Top {inning} · {scoreLabel} {myRuns}–{opponentRuns}
        </span>
      </div>

      {/* Choices */}
      <div className={`grid gap-2 ${choices.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
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
