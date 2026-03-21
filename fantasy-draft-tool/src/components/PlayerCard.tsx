import type { ContextualPlayer, EspnAvailabilitySignal } from "../lib/data";
import { AVAILABILITY_COLOR, TIER_COLOR } from "../lib/tokens";

interface Props {
  evaluated: ContextualPlayer;
  availabilitySignal?: EspnAvailabilitySignal;
  queued: boolean;
  drafted: boolean;
  onToggleQueue: (playerId: string) => void;
  onDraft: (playerId: string) => void;
  onMarkTaken: (playerId: string) => void;
}

const AVAILABILITY_LABELS: Record<
  NonNullable<EspnAvailabilitySignal>["status"],
  string
> = {
  now:     "ESPN HOT",
  swing:   "LIKELY GONE",
  fragile: "BUBBLE",
  safe:    "SAFER",
  unknown: "UNTRACKED",
};

export default function PlayerCard({
  evaluated,
  availabilitySignal,
  queued,
  drafted,
  onToggleQueue,
  onDraft,
  onMarkTaken,
}: Props) {
  const { player } = evaluated;
  const tierColor  = TIER_COLOR[player.tier] ?? "var(--color-dim)";
  const availColor = availabilitySignal
    ? AVAILABILITY_COLOR[availabilitySignal.status]
    : null;
  const accentColor = availColor ?? tierColor;

  return (
    <article
      className="group flex h-full flex-col transition-colors"
      style={{
        background:    "var(--color-card)",
        borderLeft:    `3px solid ${accentColor}`,
        borderTop:     "1px solid rgba(255,255,255,0.14)",
        borderRight:   "1px solid rgba(255,255,255,0.14)",
        borderBottom:  "1px solid rgba(255,255,255,0.14)",
      }}
    >
      {/* Header row */}
      <div
        className="flex items-start justify-between gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="min-w-0 flex-1">
          {/* Tier + badges row */}
          <div className="flex items-center gap-3 mb-1.5">
            <span
              className="font-display text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: tierColor }}
            >
              TIER {player.tier}
            </span>
            {player.expertRank != null && (
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-purple">
                #{player.expertRank} EXP
              </span>
            )}
            {player.batting && player.pitching && (
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-info">
                2-WAY
              </span>
            )}
            {player.injured && (
              <span
                className="font-display text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{
                  color: player.injuryStatus === "OUT"
                    ? "var(--color-danger)"
                    : "var(--color-warn)",
                }}
              >
                {player.injuryStatus === "OUT" ? "OUT" : "DTD"}
              </span>
            )}
          </div>
          {/* Player name */}
          <h3
            className="font-display text-2xl font-bold uppercase leading-tight text-white"
            style={{ letterSpacing: "0.02em" }}
          >
            {player.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{evaluated.archetype}</p>
        </div>

        {/* Availability / type indicator */}
        <div
          className="shrink-0 pt-1 text-right font-display text-[9px] font-bold uppercase tracking-[0.22em]"
          style={{ color: availColor ?? "var(--color-dim)" }}
        >
          {availabilitySignal
            ? AVAILABILITY_LABELS[availabilitySignal.status]
            : player.type === "batter"
              ? "BATTER"
              : "PITCHER"}
        </div>
      </div>

      {/* Decision score + Primary stat */}
      <div
        className="flex items-stretch"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="flex-1 px-4 py-3">
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.28em] text-ghost">
            DECISION
          </div>
          <div
            className="font-data mt-1 text-5xl font-medium leading-none"
            style={{ color: accentColor }}
          >
            {evaluated.decisionScore}
          </div>
        </div>
        <div
          className="flex-1 px-4 py-3"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.28em] text-ghost">
            {evaluated.primaryStat.label}
          </div>
          <div className="font-data mt-1 text-3xl font-medium leading-none text-body">
            {evaluated.primaryStat.value}
          </div>
        </div>
      </div>

      {/* Secondary stats grid */}
      <div
        className="grid grid-cols-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        {evaluated.secondaryStats.map((stat, i) => (
          <div
            key={stat.label}
            className="px-3 py-3"
            style={{
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.12)" : undefined,
            }}
          >
            <div className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-dim">
              {stat.label}
            </div>
            <div className="font-data mt-0.5 text-lg font-medium text-soft">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      <div
        className="flex flex-wrap gap-1.5 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        {evaluated.fitLabels.length > 0 ? (
          evaluated.fitLabels.map((label) => (
            <span
              key={label}
              className="font-display px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-accent"
              style={{
                background: "rgba(180,240,0,0.08)",
                border:     "1px solid rgba(180,240,0,0.2)",
              }}
            >
              {label}
            </span>
          ))
        ) : (
          <span
            className="font-display px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ghost"
            style={{ border: "1px solid rgba(255,255,255,0.14)" }}
          >
            DEPTH PROFILE
          </span>
        )}
        {evaluated.weaknesses.map((weakness) => (
          <span
            key={weakness}
            className="font-display px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-warn"
            style={{
              background: "rgba(255,136,0,0.08)",
              border:     "1px solid rgba(255,136,0,0.2)",
            }}
          >
            {weakness}
          </span>
        ))}
      </div>

      {/* Caution / fit warning */}
      {(evaluated.fitWarning || evaluated.caution) && (
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
        >
          <p className="text-xs leading-5 text-muted">
            {evaluated.fitWarning ?? evaluated.caution}
          </p>
        </div>
      )}

      {/* ESPN view box */}
      {availabilitySignal && (
        <div
          className="px-4 py-3"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            background:   "rgba(255,255,255,0.015)",
          }}
        >
          <div className="font-display mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.22em] text-dim">
            <span>ESPN VIEW</span>
            <span>
              RK {availabilitySignal.espnRank ?? "—"}
              {availabilitySignal.adp
                ? ` · ADP ${availabilitySignal.adp.toFixed(1)}`
                : ""}
            </span>
          </div>
          <p className="text-xs leading-5 text-dim">
            {availabilitySignal.note}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-auto grid grid-cols-3">
        <button
          onClick={() => onToggleQueue(player.id)}
          className="font-display py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors"
          style={
            queued
              ? {
                  background:  "rgba(255,255,255,0.1)",
                  color:       "var(--color-body)",
                  borderTop:   "1px solid rgba(255,255,255,0.12)",
                  borderRight: "1px solid rgba(255,255,255,0.14)",
                }
              : {
                  background:  "transparent",
                  color:       "var(--color-dim)",
                  borderTop:   "1px solid rgba(255,255,255,0.12)",
                  borderRight: "1px solid rgba(255,255,255,0.12)",
                }
          }
        >
          {queued ? "QUEUED ✓" : "QUEUE"}
        </button>
        <button
          onClick={() => onDraft(player.id)}
          className="font-display py-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors"
          style={
            drafted
              ? {
                  background: "rgba(255,61,61,0.15)",
                  color:      "var(--color-danger-soft)",
                  borderTop:  "1px solid rgba(255,61,61,0.25)",
                  borderRight: "1px solid rgba(255,255,255,0.12)",
                }
              : {
                  background:  `${accentColor}18`,
                  color:       accentColor,
                  borderTop:   `1px solid ${accentColor}35`,
                  borderRight: "1px solid rgba(255,255,255,0.12)",
                }
          }
        >
          {drafted ? "UNDO" : "DRAFT"}
        </button>
        <button
          onClick={() => onMarkTaken(player.id)}
          className="font-display py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-dim transition-colors hover:text-soft"
          style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
        >
          TAKEN
        </button>
      </div>
    </article>
  );
}
