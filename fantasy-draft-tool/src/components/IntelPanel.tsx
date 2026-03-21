import type { ContextualPlayer, StrategySnapshot } from "../lib/data";
import type {
  AutoRunBatch,
  EspnLeagueData,
  LeagueConfig,
  LeagueProfile,
  NeedCard,
  Player,
  TakenRecord,
} from "../types";
import { NEED_TONE_COLOR } from "../lib/tokens";
import type { BoardSection } from "./BoardMain";

interface IntelPanelProps {
  strategySnapshot: StrategySnapshot | null;
  needCards: NeedCard[];
  leagueConfig: LeagueConfig;
  lastAutoRunBatch: AutoRunBatch | null;
  lastAutoRunPlayers: Player[];
  boardSections: BoardSection[];
  takenPlayers: { record: TakenRecord; player: Player }[];
  filteredPlayers: ContextualPlayer[];
  espnData: EspnLeagueData | null;
  strategyNotes: string;
  profile: LeagueProfile;
  onUndoLastAutoRun: () => void;
  onRestoreTaken: (id: string) => void;
  onStrategyNotesChange: (notes: string) => void;
}

export default function IntelPanel({
  strategySnapshot, needCards, leagueConfig,
  lastAutoRunBatch, lastAutoRunPlayers,
  boardSections, takenPlayers, filteredPlayers, espnData,
  strategyNotes, profile,
  onUndoLastAutoRun, onRestoreTaken, onStrategyNotesChange,
}: IntelPanelProps) {
  return (
    <div className="grid gap-px xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* Left: Action hub + Needs */}
      <div className="space-y-px" style={{ borderRight: "1px solid rgba(255,255,255,0.12)" }}>
        <section
          className="p-5"
          style={{ background: "var(--color-raised)", borderLeft: "3px solid var(--color-accent)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-accent/50">
                Action hub
              </div>
              <div
                className="font-display mt-1 text-xl font-bold uppercase text-white"
                style={{ letterSpacing: "0.03em" }}
              >
                {strategySnapshot?.phaseLabel ?? "Draft posture"}
              </div>
            </div>
            <span
              className="font-display shrink-0 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-accent"
              style={{ border: "1px solid rgba(180,240,0,0.25)", background: "rgba(180,240,0,0.08)" }}
            >
              Slot {leagueConfig.draftInfo.pickNumber}
            </span>
          </div>
          <p className="mt-4 text-base leading-7 text-white">{strategySnapshot?.headline}</p>
          <p className="mt-2 text-sm leading-6 text-dim">{strategySnapshot?.detail}</p>
          <div
            className="mt-4 p-4"
            style={{ background: "rgba(180,240,0,0.04)", border: "1px solid rgba(180,240,0,0.15)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-[9px] font-bold uppercase tracking-[0.25em] text-accent/50">
                  Last auto run
                </div>
                {lastAutoRunBatch && lastAutoRunPlayers.length > 0 ? (
                  <p className="mt-1.5 text-xs leading-5 text-soft">
                    ESPN burned {lastAutoRunBatch.taken.length} picks (
                    {lastAutoRunBatch.startPick}→{lastAutoRunBatch.endPick})
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs leading-5 text-muted">
                    Sim To Next Turn populates this after your pick.
                  </p>
                )}
              </div>
              <button
                onClick={onUndoLastAutoRun}
                disabled={!lastAutoRunBatch}
                className={`font-display shrink-0 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  lastAutoRunBatch
                    ? "border border-white/10 text-soft hover:border-white/20 hover:text-white"
                    : "border border-white/10 text-dim"
                }`}
              >
                Undo
              </button>
            </div>
            {lastAutoRunBatch && lastAutoRunPlayers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {lastAutoRunPlayers.slice(0, 6).map((player) => (
                  <span
                    key={player.id}
                    className="font-display border border-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-dim"
                  >
                    {player.name}
                  </span>
                ))}
                {lastAutoRunPlayers.length > 6 && (
                  <span className="font-display border border-white/12 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-dim">
                    +{lastAutoRunPlayers.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(strategySnapshot?.priorityLabels ?? []).map((label) => (
              <span
                key={label}
                className="font-display border border-accent/20 bg-accent/6 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-accent"
              >
                {label}
              </span>
            ))}
          </div>
          <div
            className="mt-4 p-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <div className="font-display text-[9px] font-bold uppercase tracking-[0.25em] text-dim">
              Draft edge
            </div>
            <p className="mt-2 text-xs leading-5 text-soft">{strategySnapshot?.exploit}</p>
          </div>
        </section>

        <section
          className="p-5"
          style={{ background: "var(--color-raised)", borderLeft: "3px solid rgba(255,61,61,0.5)" }}
        >
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-danger/50">
            Needs right now
          </div>
          <div className="mt-4 space-y-2">
            {needCards.map((need) => {
              const color = NEED_TONE_COLOR[need.tone];
              return (
                <div
                  key={need.title}
                  className="border p-3"
                  style={{
                    borderColor: `${color}4d`,
                    background:  `${color}14`,
                    color,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em]">
                      {need.title}
                    </div>
                    <div className="font-data text-sm font-medium">{need.value}</div>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 opacity-80">{need.detail}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Right: Draft window + Room picks + Notes */}
      <div className="space-y-px">
        <section className="p-5" style={{ background: "var(--color-raised)" }}>
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">
            Draft window
          </div>
          {espnData ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="font-display mb-2.5 text-[8px] font-bold uppercase tracking-[0.2em] text-danger/70">
                  Take now or lose
                </div>
                <div className="space-y-1">
                  {(boardSections.find((s) => s.id === "likely-gone")?.players ?? [])
                    .slice(0, 6)
                    .map((entry) => {
                      const p    = entry.player;
                      const stat1 = entry.primaryStat;
                      const stat2 = p.type === "batter" ? entry.secondaryStats[0] : entry.secondaryStats[1];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5"
                          style={{ background: "rgba(255,61,61,0.05)", border: "1px solid rgba(255,61,61,0.12)" }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="font-display shrink-0 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-dim"
                              style={{ background: "rgba(255,255,255,0.06)" }}
                            >
                              {p.position}
                            </span>
                            <span className="truncate text-[11px] font-medium text-white/90">{p.name}</span>
                          </div>
                          <div className="font-data shrink-0 flex gap-2 text-[10px] text-soft">
                            <span>{stat1.label} <span className="text-white">{stat1.value}</span></span>
                            {stat2 && <span>{stat2.label} <span className="text-white">{stat2.value}</span></span>}
                          </div>
                        </div>
                      );
                    })}
                  {(boardSections.find((s) => s.id === "likely-gone")?.players ?? []).length === 0 && (
                    <p className="text-xs text-dim">No immediate pressure this window.</p>
                  )}
                </div>
              </div>
              <div>
                <div className="font-display mb-2.5 text-[8px] font-bold uppercase tracking-[0.2em] text-accent/70">
                  Will survive the gap
                </div>
                <div className="space-y-1">
                  {(boardSections.find((s) => s.id === "safe")?.players ?? [])
                    .slice(0, 6)
                    .map((entry) => {
                      const p    = entry.player;
                      const stat1 = entry.primaryStat;
                      const stat2 = p.type === "batter" ? entry.secondaryStats[0] : entry.secondaryStats[1];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5"
                          style={{ background: "rgba(180,240,0,0.03)", border: "1px solid rgba(180,240,0,0.1)" }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="font-display shrink-0 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-dim"
                              style={{ background: "rgba(255,255,255,0.06)" }}
                            >
                              {p.position}
                            </span>
                            <span className="truncate text-[11px] font-medium text-white/90">{p.name}</span>
                          </div>
                          <div className="font-data shrink-0 flex gap-2 text-[10px] text-soft">
                            <span>{stat1.label} <span className="text-white">{stat1.value}</span></span>
                            {stat2 && <span>{stat2.label} <span className="text-white">{stat2.value}</span></span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {filteredPlayers.slice(0, 8).map((entry) => {
                const p    = entry.player;
                const stat1 = entry.primaryStat;
                const stat2 = p.type === "batter" ? entry.secondaryStats[0] : entry.secondaryStats[1];
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="font-display shrink-0 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-dim"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        {p.position}
                      </span>
                      <span className="truncate text-[11px] font-medium text-white/90">{p.name}</span>
                    </div>
                    <div className="font-data shrink-0 flex gap-2 text-[10px] text-soft">
                      <span>{stat1.label} <span className="text-white">{stat1.value}</span></span>
                      {stat2 && <span>{stat2.label} <span className="text-white">{stat2.value}</span></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-px md:grid-cols-2">
          <section className="p-5" style={{ background: "var(--color-raised)" }}>
            <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">
              Recent room picks
            </div>
            <div className="mt-3 space-y-1.5">
              {takenPlayers.length === 0 ? (
                <p
                  className="border border-dashed px-4 py-5 text-xs leading-6 text-dim"
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}
                >
                  {espnData ? "ESPN picks appear here as the room moves." : "Mark players Taken on their card."}
                </p>
              ) : (
                (() => {
                  const teams = leagueConfig.teams;
                  const byRound = new Map<number, typeof takenPlayers>();
                  for (const entry of takenPlayers) {
                    const round = Math.ceil(entry.record.takenAtPick / teams);
                    if (!byRound.has(round)) byRound.set(round, []);
                    byRound.get(round)!.push(entry);
                  }
                  return [...byRound.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([round, picks]) => (
                      <div key={round}>
                        <div className="font-display mb-1 mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-dim">
                          Round {round}
                        </div>
                        <div className="space-y-1.5">
                          {picks.map(({ record, player }) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between gap-3 border border-white/10 p-2.5"
                              style={{ background: "var(--color-panel)" }}
                            >
                              <div>
                                <div
                                  className="font-display font-bold uppercase text-soft"
                                  style={{ fontSize: "12px", letterSpacing: "0.02em" }}
                                >
                                  {player.name}
                                </div>
                                <div className="mt-0.5 text-[9px] text-dim">
                                  {player.position} · pick {record.takenAtPick}
                                </div>
                              </div>
                              <button
                                onClick={() => onRestoreTaken(player.id)}
                                className="font-display shrink-0 border border-white/14 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-dim transition-colors hover:text-soft"
                              >
                                Undo
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                })()
              )}
            </div>
          </section>

          <section className="p-5" style={{ background: "var(--color-raised)" }}>
            <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">
              Room notes
            </div>
            <textarea
              value={strategyNotes}
              onChange={(e) => onStrategyNotesChange(e.target.value)}
              placeholder="Log what the room is doing: ace run, SB panic, holds pushed up…"
              className="mt-3 min-h-32 w-full border border-white/15 bg-base px-3 py-2.5 text-xs leading-6 text-body placeholder:text-dim focus:border-accent/40 focus:outline-none"
              style={{ borderRadius: "2px" }}
            />
            {(strategySnapshot?.warnings ?? profile.dataWarnings).length > 0 && (
              <>
                <div className="mt-4 font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">
                  Warnings
                </div>
                <div className="mt-2 space-y-1.5">
                  {(strategySnapshot?.warnings ?? profile.dataWarnings).map((warning) => (
                    <div
                      key={warning}
                      className="border border-white/10 p-3 text-xs leading-5 text-muted"
                      style={{ borderLeft: "2px solid rgba(255,136,0,0.4)" }}
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
