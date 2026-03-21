import type { ContextualPlayer, DraftViewFilter, EspnAvailabilitySignal, FocusArea } from "../lib/data";
import { getPlayerPositions } from "../lib/data";
import type { DraftedRecord, LeagueProfile, RosterSlot } from "../types";
import FilterBar from "./FilterBar";

function availableSlots(
  slots: RosterSlot[],
  drafted: DraftedRecord[],
  currentPlayerId?: string,
): RosterSlot[] {
  const occupied = new Set(
    drafted
      .filter((r) => r.slotId && r.playerId !== currentPlayerId)
      .map((r) => r.slotId as string),
  );
  return slots.filter((slot) => !occupied.has(slot.id));
}

interface BoardSidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedType: DraftViewFilter;
  onTypeChange: (t: DraftViewFilter) => void;
  focusArea: FocusArea;
  onFocusChange: (f: FocusArea) => void;
  queueOnly: boolean;
  onQueueOnlyChange: (v: boolean) => void;
  queuePlayers: ContextualPlayer[];
  availabilityByPlayerId: Record<string, EspnAvailabilitySignal>;
  onToggleQueue: (id: string) => void;
  drafted: DraftedRecord[];
  profile: LeagueProfile;
  contextualById: Record<string, ContextualPlayer>;
  onDraft: (id: string) => void;
  onUpdateSlotAssignment: (playerId: string, slotId: string) => void;
}

export default function BoardSidebar({
  searchQuery, onSearchChange, selectedType, onTypeChange,
  focusArea, onFocusChange, queueOnly, onQueueOnlyChange,
  queuePlayers, availabilityByPlayerId, onToggleQueue,
  drafted, profile, contextualById, onDraft, onUpdateSlotAssignment,
}: BoardSidebarProps) {
  return (
    <aside
      className="xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto"
      style={{ borderRight: "1px solid rgba(255,255,255,0.14)", background: "var(--color-surface)" }}
    >
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedType={selectedType}
          onTypeChange={onTypeChange}
          focusArea={focusArea}
          onFocusChange={onFocusChange}
          queueOnly={queueOnly}
          onQueueOnlyChange={onQueueOnlyChange}
        />
      </div>

      <section className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">Queue</div>
          <span className="font-data text-xs text-accent">{queuePlayers.length}</span>
        </div>
        <div className="space-y-1">
          {queuePlayers.length === 0 ? (
            <p
              className="border border-dashed px-3 py-4 text-xs leading-5 text-dim"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              No targets queued yet.
            </p>
          ) : (
            queuePlayers.map((entry, index) => (
              <div
                key={entry.player.id}
                className="flex items-center justify-between gap-2 p-2.5"
                style={{ border: "1px solid rgba(255,255,255,0.12)", background: "var(--color-panel)" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-data text-[9px] text-dim">#{index + 1}</span>
                    <span
                      className="font-display truncate text-[11px] font-bold uppercase text-white"
                      style={{ letterSpacing: "0.02em" }}
                    >
                      {entry.player.name}
                    </span>
                  </div>
                  {availabilityByPlayerId[entry.player.id] && (
                    <div className="mt-0.5 truncate text-[9px] text-muted">
                      {availabilityByPlayerId[entry.player.id].note}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onToggleQueue(entry.player.id)}
                  className="font-display shrink-0 text-[11px] font-bold text-dim transition-colors hover:text-soft"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-dim">My roster</div>
          <span className="font-data text-xs text-soft">{drafted.length}</span>
        </div>
        <div className="space-y-1">
          {drafted.length === 0 ? (
            <p
              className="border border-dashed px-3 py-4 text-xs leading-5 text-dim"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              No picks yet.
            </p>
          ) : (
            drafted.map((record) => {
              const entry = contextualById[record.playerId];
              if (!entry) return null;
              const slotOptions = availableSlots(profile.rosterSlots, drafted, record.playerId);
              return (
                <div
                  key={record.playerId}
                  className="p-2.5"
                  style={{
                    border:      "1px solid rgba(255,255,255,0.12)",
                    background:  "var(--color-panel)",
                    borderLeft:  "2px solid rgba(180,240,0,0.4)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="font-display truncate text-[11px] font-bold uppercase text-white"
                        style={{ letterSpacing: "0.02em" }}
                      >
                        {entry.player.name}
                      </div>
                      <div className="mt-0.5 text-[9px] text-muted">
                        {getPlayerPositions(entry.player).join("/")} ·{" "}
                        {entry.player.tier === "ELITE" ? "ELITE" : `T${entry.player.tier}`}
                      </div>
                    </div>
                    <button
                      onClick={() => onDraft(record.playerId)}
                      className="font-display shrink-0 text-[11px] font-bold text-dim transition-colors hover:text-soft"
                    >
                      ×
                    </button>
                  </div>
                  <select
                    value={record.slotId ?? ""}
                    onChange={(e) => onUpdateSlotAssignment(record.playerId, e.target.value)}
                    className="mt-2 w-full border border-white/12 bg-base px-2 py-1.5 text-[10px] text-dim focus:border-accent/40 focus:outline-none"
                    style={{ borderRadius: "2px" }}
                  >
                    <option value="">No slot</option>
                    {slotOptions.map((slot) => (
                      <option key={slot.id} value={slot.id}>{slot.label}</option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>
      </section>
    </aside>
  );
}
