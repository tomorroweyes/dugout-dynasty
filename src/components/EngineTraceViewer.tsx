import { useState } from "react";
import type { GameTraceLog, AtBatTrace, GameLevelEvent } from "@/types/trace";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

interface EngineTraceViewerProps {
  traceLog: GameTraceLog;
}

function RollRow({ label, rawValue, scaledValue, threshold, passed }: {
  label: string;
  rawValue: number;
  scaledValue?: number;
  threshold?: number;
  passed: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono py-0.5">
      <span className="w-32 text-muted-foreground truncate">{label}</span>
      <span className="w-16 text-right">{rawValue.toFixed(4)}</span>
      {scaledValue !== undefined && (
        <span className="w-16 text-right text-blue-500">{scaledValue.toFixed(1)}</span>
      )}
      {threshold !== undefined && (
        <span className="w-16 text-right text-muted-foreground">/ {threshold.toFixed(1)}</span>
      )}
      <Badge variant={passed ? "default" : "destructive"} className="text-[10px] px-1 py-0">
        {passed ? "PASS" : "FAIL"}
      </Badge>
    </div>
  );
}

function StatPipelineTable({ pipeline }: { pipeline: NonNullable<AtBatTrace["statPipeline"]> }) {
  const b = pipeline.batter;
  const p = pipeline.pitcher;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <div className="font-semibold mb-1">Batter Stats</div>
        <table className="w-full font-mono">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left pr-2">Layer</th>
              <th className="text-right px-1">PWR</th>
              <th className="text-right px-1">CON</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="pr-2">Base</td><td className="text-right px-1">{b.base.power}</td><td className="text-right px-1">{b.base.contact}</td></tr>
            <tr><td className="pr-2">+Tech</td><td className="text-right px-1">{b.withTechniques.power}</td><td className="text-right px-1">{b.withTechniques.contact}</td></tr>
            <tr><td className="pr-2">+Equip</td><td className="text-right px-1">{b.withEquipment.power}</td><td className="text-right px-1">{b.withEquipment.contact}</td></tr>
            <tr><td className="pr-2">+Approach</td><td className="text-right px-1">{b.withApproach.power}</td><td className="text-right px-1">{b.withApproach.contact}</td></tr>
            <tr className="font-semibold"><td className="pr-2">+Ability</td><td className="text-right px-1">{b.withAbility.power}</td><td className="text-right px-1">{b.withAbility.contact}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="font-semibold mb-1">Pitcher Stats</div>
        <table className="w-full font-mono">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left pr-2">Layer</th>
              <th className="text-right px-1">VEL</th>
              <th className="text-right px-1">CTL</th>
              <th className="text-right px-1">BRK</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="pr-2">Base</td><td className="text-right px-1">{p.base.velocity}</td><td className="text-right px-1">{p.base.control}</td><td className="text-right px-1">{p.base.break}</td></tr>
            <tr><td className="pr-2">+Tech</td><td className="text-right px-1">{p.withTechniques.velocity}</td><td className="text-right px-1">{p.withTechniques.control}</td><td className="text-right px-1">{p.withTechniques.break}</td></tr>
            <tr><td className="pr-2">+Equip</td><td className="text-right px-1">{p.withEquipment.velocity}</td><td className="text-right px-1">{p.withEquipment.control}</td><td className="text-right px-1">{p.withEquipment.break}</td></tr>
            <tr><td className="pr-2">+Fatigue</td><td className="text-right px-1">{p.withFatigue.velocity}</td><td className="text-right px-1">{p.withFatigue.control}</td><td className="text-right px-1">{p.withFatigue.break}</td></tr>
            <tr><td className="pr-2">+Strategy</td><td className="text-right px-1">{p.withStrategy.velocity}</td><td className="text-right px-1">{p.withStrategy.control}</td><td className="text-right px-1">{p.withStrategy.break}</td></tr>
            <tr className="font-semibold"><td className="pr-2">+Ability</td><td className="text-right px-1">{p.withAbility.velocity}</td><td className="text-right px-1">{p.withAbility.control}</td><td className="text-right px-1">{p.withAbility.break}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutcomeModifiersTable({ mods }: { mods: NonNullable<AtBatTrace["outcomeModifiers"]> }) {
  return (
    <div className="text-xs font-mono space-y-1">
      <div className="grid grid-cols-4 gap-1 text-muted-foreground">
        <span>Modifier</span>
        <span className="text-right">Base</span>
        <span className="text-right">+Abilities</span>
        <span className="text-right">Final</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <span>K%</span>
        <span className="text-right">{mods.strikeoutChance.base.toFixed(1)}</span>
        <span className="text-right">{mods.strikeoutChance.afterAbilities.toFixed(1)}</span>
        <span className="text-right font-semibold">{mods.strikeoutChance.final.toFixed(1)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <span>BB%</span>
        <span className="text-right">{mods.walkChance.base.toFixed(1)}</span>
        <span className="text-right">{mods.walkChance.afterAbilities.toFixed(1)}</span>
        <span className="text-right font-semibold">{mods.walkChance.final.toFixed(1)}</span>
      </div>
      {mods.netScore && (
        <div className="grid grid-cols-4 gap-1">
          <span>NetScore</span>
          <span className="text-right">{mods.netScore.raw.toFixed(1)}</span>
          <span className="text-right">{mods.netScore.afterAbilities.toFixed(1)}</span>
          <span className="text-right font-semibold">{mods.netScore.final.toFixed(1)}</span>
        </div>
      )}
      {mods.hitRoll && (
        <div className="grid grid-cols-4 gap-1">
          <span>HitRoll</span>
          <span className="text-right">{mods.hitRoll.base.toFixed(1)}</span>
          <span className="text-right">{mods.hitRoll.afterAbilities.toFixed(1)}</span>
          <span className="text-right font-semibold">{mods.hitRoll.final.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  homerun: "text-purple-500",
  triple: "text-orange-500",
  double: "text-yellow-500",
  single: "text-green-500",
  walk: "text-blue-500",
  strikeout: "text-red-500",
  groundout: "text-red-400",
  flyout: "text-red-400",
  lineout: "text-red-400",
  popout: "text-red-400",
};

function AtBatTraceRow({ trace }: { trace: AtBatTrace }) {
  const [expanded, setExpanded] = useState(false);
  const halfInning = trace.isTop ? "T" : "B";
  const outcomeColor = OUTCOME_COLORS[trace.outcome] ?? "";

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1.5 px-2 text-xs hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <span className="text-muted-foreground w-8">#{trace.index + 1}</span>
        <span className="text-muted-foreground w-8">{halfInning}{trace.inning}</span>
        <span className="flex-1 truncate">
          {trace.batterName} vs {trace.pitcherName}
        </span>
        <span className={`font-semibold uppercase ${outcomeColor}`}>{trace.outcome}</span>
        {trace.runsScored > 0 && (
          <Badge variant="default" className="text-[10px] px-1 py-0 ml-1">{trace.runsScored} R</Badge>
        )}
        {trace.resolution.type !== "normal" && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
            {trace.resolution.type === "clash" ? "CLASH" : "GUARANTEED"}
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3 bg-muted/20">
          {/* Resolution */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Resolution</div>
            <div className="text-xs">
              {trace.resolution.type === "normal" && "Normal stat-based resolution"}
              {trace.resolution.type === "clash" && (
                <span>Ability clash: <span className="font-semibold">{trace.resolution.winner}</span> wins ({trace.resolution.batterRoll.toFixed(1)} vs {trace.resolution.pitcherRoll.toFixed(1)})</span>
              )}
              {trace.resolution.type === "guaranteed_batter" && `Guaranteed batter outcome: ${trace.resolution.outcome}`}
              {trace.resolution.type === "guaranteed_pitcher" && `Guaranteed pitcher outcome: ${trace.resolution.outcome}`}
            </div>
          </div>

          {/* Approach / Strategy */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Approach / Strategy</div>
            <div className="flex gap-4 text-xs">
              {trace.approach.batterApproach && (
                <span>Approach: <span className="font-semibold capitalize">{trace.approach.batterApproach}</span>
                  <span className="text-muted-foreground"> (adapt: {trace.approach.approachAdaptation.toFixed(2)}, x{trace.approach.consecutiveBatterApproach})</span>
                </span>
              )}
              {trace.approach.pitchStrategy && (
                <span>Strategy: <span className="font-semibold capitalize">{trace.approach.pitchStrategy}</span>
                  <span className="text-muted-foreground"> (adapt: {trace.approach.strategyAdaptation.toFixed(2)}, x{trace.approach.consecutivePitchStrategy})</span>
                </span>
              )}
            </div>
          </div>

          {/* Abilities */}
          {(trace.abilities.batterActive || trace.abilities.pitcherActive) && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Abilities</div>
              <div className="text-xs space-y-0.5">
                {trace.abilities.batterActive && (
                  <div>Batter: <span className="font-semibold">{trace.abilities.batterActive.abilityId}</span> ({trace.abilities.batterActive.effects.length} effects)</div>
                )}
                {trace.abilities.pitcherActive && (
                  <div>Pitcher: <span className="font-semibold">{trace.abilities.pitcherActive.abilityId}</span> ({trace.abilities.pitcherActive.effects.length} effects)</div>
                )}
              </div>
            </div>
          )}

          {/* Stat Pipeline */}
          {trace.statPipeline && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Stat Pipeline</div>
              <StatPipelineTable pipeline={trace.statPipeline} />
              <div className="text-xs text-muted-foreground mt-1">Defense Glove: {trace.statPipeline.defenseGlove.toFixed(1)}</div>
            </div>
          )}

          {/* Outcome Modifiers */}
          {trace.outcomeModifiers && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Outcome Modifiers</div>
              <OutcomeModifiersTable mods={trace.outcomeModifiers} />
            </div>
          )}

          {/* RNG Rolls */}
          {trace.rolls.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">RNG Rolls ({trace.rolls.length})</div>
              {trace.rolls.map((roll, i) => (
                <RollRow key={i} {...roll} />
              ))}
            </div>
          )}

          {/* Extra Bases */}
          {trace.extraBases.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Extra Base Attempts</div>
              {trace.extraBases.map((eb, i) => (
                <div key={i} className="text-xs font-mono py-0.5">
                  <span className="text-muted-foreground">{eb.fromBase} → {eb.toBase}</span>
                  {" "}SPD:{eb.runnerSpeed} GLV:{eb.defenseGlove}
                  {" "}attempt:{eb.attemptRoll.toFixed(1)}/{eb.attemptChance.toFixed(1)}
                  {eb.attempted ? (
                    <>
                      {" "}success:{eb.successRoll?.toFixed(1)}/{eb.successChance?.toFixed(1)}
                      {" "}<Badge variant={eb.succeeded ? "default" : "destructive"} className="text-[10px] px-1 py-0">
                        {eb.succeeded ? "SAFE" : "OUT"}
                      </Badge>
                    </>
                  ) : (
                    <span className="text-muted-foreground"> (held)</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Spirit */}
          {(trace.spirit.batterDelta !== 0 || trace.spirit.pitcherDelta !== 0 || trace.spirit.teamDelta !== 0) && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Spirit Momentum</div>
              <div className="flex gap-3 text-xs font-mono">
                <span>Batter: <span className={trace.spirit.batterDelta >= 0 ? "text-green-500" : "text-red-500"}>{trace.spirit.batterDelta > 0 ? "+" : ""}{trace.spirit.batterDelta}</span></span>
                <span>Pitcher: <span className={trace.spirit.pitcherDelta >= 0 ? "text-green-500" : "text-red-500"}>{trace.spirit.pitcherDelta > 0 ? "+" : ""}{trace.spirit.pitcherDelta}</span></span>
                {trace.spirit.teamDelta !== 0 && (
                  <span>Team: <span className="text-green-500">+{trace.spirit.teamDelta}</span></span>
                )}
              </div>
            </div>
          )}

          {/* Game State After */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Outs: {trace.outsBefore} → {trace.outsAfter}</span>
            <span>Bases: [{trace.basesBefore.map(b => b ? "X" : "_").join("")}] → [{trace.basesAfter.map(b => b ? "X" : "_").join("")}]</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GameEventRow({ event }: { event: GameLevelEvent }) {
  if (event.type === "inning_start") {
    return (
      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border/50">
        {event.isTop ? "Top" : "Bottom"} of Inning {event.inning}
      </div>
    );
  }
  if (event.type === "inning_end") {
    return (
      <div className="px-2 py-0.5 text-[10px] text-muted-foreground border-b border-border/50">
        End {event.isTop ? "top" : "bottom"} {event.inning} — {event.runs}R, {event.hits}H
      </div>
    );
  }
  if (event.type === "pitcher_change") {
    return (
      <div className="px-2 py-1 text-xs text-amber-500 border-b border-border/50">
        Pitcher change ({event.team}): {event.oldPitcherName} → {event.newPitcherName} ({event.reason})
      </div>
    );
  }
  return null;
}

export function EngineTraceViewer({ traceLog }: EngineTraceViewerProps) {
  // Interleave game events and at-bats chronologically
  // Game events use inning + isTop for ordering; at-bats use their index
  type TimelineEntry =
    | { kind: "event"; event: GameLevelEvent; order: number }
    | { kind: "atbat"; trace: AtBatTrace; order: number };

  const timeline: TimelineEntry[] = [];

  // Add game events with ordering based on inning position
  let eventOrder = 0;
  for (const event of traceLog.gameEvents) {
    timeline.push({ kind: "event", event, order: eventOrder++ });
  }

  // Insert at-bats — they naturally slot between inning_start and inning_end
  // We'll order by at-bat index (globally sequential)
  for (const ab of traceLog.atBats) {
    timeline.push({ kind: "atbat", trace: ab, order: ab.index });
  }

  // Sort by: for events, use a heuristic based on inning/half; for at-bats, by index
  // Actually, let's just render events first, then at-bats interleaved per half-inning
  const halfInnings = new Map<string, { events: GameLevelEvent[]; atBats: AtBatTrace[] }>();

  for (const event of traceLog.gameEvents) {
    if (event.type === "pitcher_change") {
      const key = `${event.inning}-pre`;
      if (!halfInnings.has(key)) halfInnings.set(key, { events: [], atBats: [] });
      halfInnings.get(key)!.events.push(event);
      continue;
    }
    const key = `${event.inning}-${event.isTop ? "top" : "bot"}`;
    if (!halfInnings.has(key)) halfInnings.set(key, { events: [], atBats: [] });
    halfInnings.get(key)!.events.push(event);
  }

  for (const ab of traceLog.atBats) {
    const key = `${ab.inning}-${ab.isTop ? "top" : "bot"}`;
    if (!halfInnings.has(key)) halfInnings.set(key, { events: [], atBats: [] });
    halfInnings.get(key)!.atBats.push(ab);
  }

  // Get sorted half-inning keys
  const sortedKeys = Array.from(halfInnings.keys()).sort((a, b) => {
    const [aInning, aHalf] = a.split("-");
    const [bInning, bHalf] = b.split("-");
    const inningDiff = parseInt(aInning) - parseInt(bInning);
    if (inningDiff !== 0) return inningDiff;
    const order = { pre: 0, top: 1, bot: 2 };
    return (order[aHalf as keyof typeof order] ?? 0) - (order[bHalf as keyof typeof order] ?? 0);
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(traceLog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `engine-trace-${traceLog.timestamp.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            {traceLog.atBats.length} at-bats | {traceLog.gameEvents.length} events | {traceLog.totalInnings} innings
          </div>
          <div>
            Final: {traceLog.finalScore.home} - {traceLog.finalScore.away}
            {traceLog.seed !== undefined && <span className="ml-2">Seed: {traceLog.seed}</span>}
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
        >
          <Download className="w-3 h-3" />
          Export JSON
        </button>
      </div>

      {/* Timeline */}
      <div className="border border-border rounded overflow-hidden max-h-[500px] overflow-y-auto">
        {sortedKeys.map((key) => {
          const half = halfInnings.get(key)!;
          return (
            <div key={key}>
              {half.events.filter(e => e.type === "pitcher_change" || e.type === "inning_start").map((e, i) => (
                <GameEventRow key={`event-start-${i}`} event={e} />
              ))}
              {half.atBats.map((ab) => (
                <AtBatTraceRow key={ab.index} trace={ab} />
              ))}
              {half.events.filter(e => e.type === "inning_end").map((e, i) => (
                <GameEventRow key={`event-end-${i}`} event={e} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
