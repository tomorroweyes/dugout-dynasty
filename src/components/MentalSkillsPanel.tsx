/**
 * Skill Compass — Mental Skills UI Panel
 *
 * Visualises a player's five mental skills as:
 *  1. A radar (pentagon) chart — current ranks vs. maximum potential
 *  2. Individual skill cards with confidence bars
 *  3. Signature skill spotlight (if earned)
 *  4. Breakthrough history summary
 *
 * All display data flows through `mentalSkillDisplay.ts` helpers so the
 * rendering logic stays pure and the geometry is independently tested.
 */

import { Player } from "@/types/game";
import { CONFIDENCE_ACTIVE_THRESHOLD } from "@/types/mentalSkills";
import { Badge } from "@/components/ui/8bit/badge";
import { Progress } from "@/components/ui/8bit/progress";
import { cn } from "@/lib/utils";
import { Zap, Star, BrainCircuit } from "lucide-react";
import {
  COMPASS_AXES,
  buildRadarPoints,
  buildReferenceRingPoints,
  getSkillDisplayState,
  getSkillRank,
  getSkillConfidence,
  getActiveSignatureSkill,
  getArchivedSignatureSkills,
  getMentalSkillSummary,
} from "@/engine/mentalSkillDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SVG_SIZE  = 200;
const CENTER    = SVG_SIZE / 2;
const MAX_RADIUS = 72; // px — rank-5 reaches this distance from center

/** How far the axis label sits beyond the rank-5 ring */
const LABEL_OFFSET = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers (consistent with the 8-bit palette)
// ─────────────────────────────────────────────────────────────────────────────

function stateColor(state: "active" | "dormant" | "undiscovered"): string {
  if (state === "active")       return "text-emerald-400";
  if (state === "dormant")      return "text-amber-400";
  return "text-muted-foreground";
}

function confidenceBarColor(confidence: number): string {
  if (confidence >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (confidence >= CONFIDENCE_ACTIVE_THRESHOLD) return "bg-amber-500 dark:bg-amber-400";
  return "bg-red-500 dark:bg-red-400";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rank pips (filled / empty circles up to 5)
 */
function RankPips({ rank }: { rank: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Rank ${rank} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full border",
            i < rank
              ? "bg-primary border-primary"
              : "bg-transparent border-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Radar pentagon chart built from pure SVG
 */
function SkillCompassChart({ player }: { player: Player }) {
  const ranks = COMPASS_AXES.map(({ skillId }) => getSkillRank(player, skillId));

  // Polygon points for the player's actual ranks
  const playerPoints = buildRadarPoints(ranks, CENTER, CENTER, MAX_RADIUS);

  // Reference ring points for ranks 1–5
  const ringPoints = ([1, 2, 3, 4, 5] as const).map((r) =>
    buildReferenceRingPoints(CENTER, CENTER, MAX_RADIUS, r)
  );

  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="w-full max-w-[200px] mx-auto"
      aria-label="Skill Compass — radar chart of mental skill ranks"
    >
      {/* Reference grid rings (outermost = rank 5) */}
      {ringPoints.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={i === 4 ? 1 : 0.5}
          className="text-muted-foreground/20"
        />
      ))}

      {/* Axis lines from center to rank-5 corners */}
      {COMPASS_AXES.map(({ angleDeg, skillId }) => {
        const rad = (angleDeg * Math.PI) / 180;
        const x2 = CENTER + MAX_RADIUS * Math.cos(rad);
        const y2 = CENTER + MAX_RADIUS * Math.sin(rad);
        return (
          <line
            key={skillId}
            x1={CENTER}
            y1={CENTER}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-muted-foreground/20"
          />
        );
      })}

      {/* Player skill polygon */}
      <polygon
        points={playerPoints}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        className="text-primary/30 stroke-primary"
      />

      {/* Vertex dots at each skill axis */}
      {COMPASS_AXES.map(({ angleDeg, skillId }, i) => {
        const r = (ranks[i] / 5) * MAX_RADIUS;
        const rad = (angleDeg * Math.PI) / 180;
        const cx = CENTER + r * Math.cos(rad);
        const cy = CENTER + r * Math.sin(rad);
        const state = getSkillDisplayState(player, skillId);
        const dotClass =
          state === "active"
            ? "fill-emerald-400"
            : state === "dormant"
            ? "fill-amber-400"
            : "fill-muted-foreground/30";
        if (ranks[i] === 0) return null;
        return (
          <circle
            key={skillId}
            cx={cx}
            cy={cy}
            r={3}
            className={dotClass}
          />
        );
      })}

      {/* Axis labels */}
      {COMPASS_AXES.map(({ angleDeg, skillId, trait }) => {
        const rad = (angleDeg * Math.PI) / 180;
        const lx = CENTER + (MAX_RADIUS + LABEL_OFFSET) * Math.cos(rad);
        const ly = CENTER + (MAX_RADIUS + LABEL_OFFSET) * Math.sin(rad);
        const state = getSkillDisplayState(player, skillId);
        const labelColor =
          state === "active"
            ? "#34d399"   // emerald-400
            : state === "dormant"
            ? "#fbbf24"   // amber-400
            : "#6b7280";  // muted

        return (
          <text
            key={skillId}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fontWeight={state === "active" ? "bold" : "normal"}
            fill={labelColor}
            className="font-mono"
          >
            {trait}
          </text>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

interface MentalSkillsPanelProps {
  player: Player;
}

export function MentalSkillsPanel({ player }: MentalSkillsPanelProps) {
  const summary       = getMentalSkillSummary(player);
  const activeSig     = getActiveSignatureSkill(player);
  const archivedSigs  = getArchivedSignatureSkills(player);
  const breakthroughs = player.breakthroughEvents ?? [];

  return (
    <div className="p-4 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Skill Compass</span>
        </div>
        <div className="flex gap-1 text-xs text-muted-foreground">
          <span className="text-emerald-400 font-semibold">{summary.active}</span>
          <span>active</span>
          {summary.dormant > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-400 font-semibold">{summary.dormant}</span>
              <span>dormant</span>
            </>
          )}
          {summary.undiscovered > 0 && (
            <>
              <span>·</span>
              <span className="font-semibold">{summary.undiscovered}</span>
              <span>hidden</span>
            </>
          )}
        </div>
      </div>

      {/* ── Radar chart ─────────────────────────────────────────────────── */}
      <div className="flex justify-center py-2">
        <SkillCompassChart player={player} />
      </div>

      {/* ── Individual skill cards ──────────────────────────────────────── */}
      <div className="space-y-2">
        {COMPASS_AXES.map(({ skillId, label, trait }) => {
          const state       = getSkillDisplayState(player, skillId);
          const rank        = getSkillRank(player, skillId);
          const confidence  = getSkillConfidence(player, skillId);
          const isUndiscovered = state === "undiscovered";

          return (
            <div
              key={skillId}
              className={cn(
                "rounded border p-2 space-y-1 transition-opacity",
                isUndiscovered ? "opacity-40" : "opacity-100"
              )}
            >
              {/* Row 1: name + trait badge + state badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold", stateColor(state))}>
                    {label}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-auto">
                    {trait}
                  </Badge>
                </div>
                <Badge
                  variant={
                    state === "active"       ? "default"
                    : state === "dormant"    ? "secondary"
                    : "outline"
                  }
                  className="text-[10px] px-1 py-0 h-auto"
                >
                  {state === "undiscovered" ? "?" : state}
                </Badge>
              </div>

              {/* Row 2: rank pips + confidence bar (hidden if undiscovered) */}
              {!isUndiscovered && (
                <div className="flex items-center gap-3">
                  <RankPips rank={rank} />
                  <div className="flex-1">
                    <Progress
                      value={confidence}
                      className="h-1"
                      progressBg={confidenceBarColor(confidence)}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">
                    {confidence}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Signature Skill spotlight ───────────────────────────────────── */}
      {activeSig && (
        <div className="rounded border border-primary/40 bg-primary/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">
              Signature Skill
            </span>
          </div>
          <div className="text-sm font-bold">{activeSig.skillName}</div>
          <div className="text-xs text-muted-foreground">
            +{Math.round(activeSig.effectBonus * 100)}% above Rank 5 ·{" "}
            {activeSig.reputation.scoutLevel === 0
              ? "Reputation: Unknown"
              : activeSig.reputation.scoutLevel === 1
              ? "Reputation: Scouted"
              : activeSig.reputation.scoutLevel === 2
              ? "Reputation: Pattern detected"
              : "Reputation: Fully mapped"}
          </div>
          {activeSig.reputation.highLeverageUses > 0 && (
            <div className="text-xs text-muted-foreground">
              High-leverage uses: {activeSig.reputation.highLeverageUses}
            </div>
          )}
        </div>
      )}

      {/* Archived sigs (legacy) */}
      {archivedSigs.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Legacy Skills</div>
          {archivedSigs.map((sig) => (
            <div key={sig.signatureId} className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <span>↳</span>
              <span>{sig.skillName}</span>
              <span>(archived)</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Breakthrough history ────────────────────────────────────────── */}
      {breakthroughs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Breakthrough History ({breakthroughs.length})</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...breakthroughs].reverse().map((evt) => (
              <div
                key={evt.breakthroughId}
                className="text-xs text-muted-foreground/80 border-l-2 border-amber-400/40 pl-2"
              >
                <div className="font-medium text-foreground/80">{evt.memoryLabel}</div>
                {evt.narrative && (
                  <div className="text-[10px] truncate">{evt.narrative}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {summary.undiscovered === 5 && breakthroughs.length === 0 && (
        <div className="text-center text-xs text-muted-foreground py-4">
          <div className="text-2xl mb-1">🧠</div>
          <div>No mental skills discovered yet.</div>
          <div className="opacity-70 mt-0.5">
            Play high-leverage at-bats to unlock your hidden potential.
          </div>
        </div>
      )}
    </div>
  );
}
