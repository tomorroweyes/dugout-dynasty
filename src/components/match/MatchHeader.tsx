import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/8bit/button";
import { ChevronDown } from "lucide-react";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import { SIM_MODE_LABELS, type SimMode } from "./constants";

interface MatchHeaderProps {
  matchState: InteractiveMatchState;
  selectedSimMode: SimMode;
  setSelectedSimMode: (mode: SimMode) => void;
  autoSimulating: boolean;
  onAutoSim: (mode: SimMode) => void;
}

export function MatchHeader({
  matchState,
  selectedSimMode,
  setSelectedSimMode,
  autoSimulating,
  onAutoSim,
}: MatchHeaderProps) {
  const [simDropdownOpen, setSimDropdownOpen] = useState(false);
  const simDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!simDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (simDropdownRef.current && !simDropdownRef.current.contains(e.target as Node)) {
        setSimDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [simDropdownOpen]);

  return (
    <header className="border-b border-border bg-card px-4 py-3">
      <div className="w-full max-w-350 mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">Dugout Dynasty</span>
          <div className="flex items-center gap-3 text-xl font-bold tabular-nums">
            <span className="text-muted-foreground text-sm font-normal">
              Inning {matchState.inning} {matchState.isTop ? "▲" : "▼"}
            </span>
            <span className="text-blue-400 dark:text-blue-300">{matchState.myRuns}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-red-400 dark:text-red-300">{matchState.opponentRuns}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {matchState.outs} Out{matchState.outs !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground/50">|</span>
            <span>
              Hits: {matchState.myHits} - {matchState.opponentHits}
            </span>
          </div>
        </div>
        <div className="relative" ref={simDropdownRef}>
          <div className="flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAutoSim(selectedSimMode)}
              disabled={autoSimulating}
              className="rounded-r-none border-r-0"
            >
              {autoSimulating ? "Simming..." : SIM_MODE_LABELS[selectedSimMode]}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSimDropdownOpen((o) => !o)}
              disabled={autoSimulating}
              className="rounded-l-none px-1.5"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>
          {simDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-40">
              {(["half", "inning", "runners", "end"] as SimMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSelectedSimMode(mode);
                    setSimDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                    mode === selectedSimMode ? "font-semibold bg-accent/50" : ""
                  } ${mode === "end" ? "text-destructive" : ""}`}
                >
                  {SIM_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
