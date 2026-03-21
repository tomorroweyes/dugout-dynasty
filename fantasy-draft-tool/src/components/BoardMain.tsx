import type { ContextualPlayer, EspnAvailabilitySignal } from "../lib/data";
import type { EspnLeagueData } from "../types";
import PlayerCard from "./PlayerCard";

export interface BoardSection {
  id: string;
  title: string;
  subtitle: string;
  toneClass: string;
  players: ContextualPlayer[];
}

interface BoardMainProps {
  boardSections: BoardSection[];
  availabilityByPlayerId: Record<string, EspnAvailabilitySignal>;
  queueIds: string[];
  draftedSet: Set<string>;
  filteredCount: number;
  takenCount: number;
  espnData: EspnLeagueData | null;
  onToggleQueue: (id: string) => void;
  onDraft: (id: string) => void;
  onMarkTaken: (id: string) => void;
}

export default function BoardMain({
  boardSections, availabilityByPlayerId, queueIds, draftedSet,
  filteredCount, takenCount, espnData,
  onToggleQueue, onDraft, onMarkTaken,
}: BoardMainProps) {
  return (
    <main>
      <div
        className="flex flex-wrap items-center gap-1.5 p-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
      >
        <span className="font-display border border-white/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-dim">
          {filteredCount} available
        </span>
        <span className="font-display border border-white/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-dim">
          {takenCount} taken
        </span>
        <span
          className="font-display border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
          style={
            espnData
              ? { borderColor: "rgba(180,240,0,0.3)", color: "var(--color-accent)", background: "rgba(180,240,0,0.06)" }
              : { borderColor: "rgba(255,255,255,0.06)", color: "var(--color-ghost)" }
          }
        >
          {espnData ? "ESPN Active" : "ESPN Inactive"}
        </span>
      </div>
      <div className="space-y-px">
        {boardSections.map((section) => (
          <section key={section.id} className={`border p-4 ${section.toneClass}`}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3
                  className="font-display font-bold uppercase text-white"
                  style={{ letterSpacing: "0.04em", fontSize: "14px" }}
                >
                  {section.title}
                </h3>
                <p className="mt-0.5 text-[10px] text-muted">{section.subtitle}</p>
              </div>
              <span className="font-display shrink-0 border border-white/14 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-dim">
                {section.players.length}
              </span>
            </div>
            <div
              className="grid gap-px lg:grid-cols-2 2xl:grid-cols-3"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {section.players.map((entry) => (
                <PlayerCard
                  key={entry.player.id}
                  evaluated={entry}
                  availabilitySignal={availabilityByPlayerId[entry.player.id]}
                  queued={queueIds.includes(entry.player.id)}
                  drafted={draftedSet.has(entry.player.id)}
                  onToggleQueue={onToggleQueue}
                  onDraft={onDraft}
                  onMarkTaken={onMarkTaken}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
