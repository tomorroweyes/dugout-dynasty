import type { DraftViewFilter, FocusArea } from "../lib/data";

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: DraftViewFilter;
  onTypeChange: (type: DraftViewFilter) => void;
  focusArea: FocusArea;
  onFocusChange: (focus: FocusArea) => void;
  queueOnly: boolean;
  onQueueOnlyChange: (enabled: boolean) => void;
}

export default function FilterBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  queueOnly,
  onQueueOnlyChange,
}: Props) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search players…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full border bg-base px-3 py-2 text-sm text-body transition-colors placeholder:text-dim focus:outline-none"
        style={{ borderColor: "rgba(255,255,255,0.12)", borderRadius: "2px" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(180,240,0,0.45)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
      />
      <div className="flex gap-px">
        {(["ALL", "batter", "pitcher"] as const).map((type) => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className="font-display flex-1 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors"
            style={
              selectedType === type
                ? { background: "var(--color-accent)", color: "var(--color-base)", border: "1px solid var(--color-accent)" }
                : { background: "transparent", color: "var(--color-muted)", border: "1px solid rgba(255,255,255,0.1)" }
            }
          >
            {type === "ALL" ? "All" : type === "batter" ? "Batters" : "Pitchers"}
          </button>
        ))}
        <button
          onClick={() => onQueueOnlyChange(!queueOnly)}
          className="font-display px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors"
          style={
            queueOnly
              ? { background: "var(--color-danger)", color: "#fff", border: "1px solid var(--color-danger)" }
              : { background: "transparent", color: "var(--color-muted)", border: "1px solid rgba(255,255,255,0.1)" }
          }
        >
          Queue
        </button>
      </div>
    </div>
  );
}
