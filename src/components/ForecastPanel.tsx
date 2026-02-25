import type { ForecastSnapshot, ForecastRiskTag } from "@/engine/forecastPanel";

interface ForecastPanelProps {
  snapshot: ForecastSnapshot;
  modeLabel: string;
}

function riskClass(risk: ForecastRiskTag): string {
  if (risk === "High") return "text-red-400";
  if (risk === "Medium") return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export function ForecastPanel({ snapshot, modeLabel }: ForecastPanelProps) {
  return (
    <div className="rounded border border-border bg-card/70 px-3 py-2">
      <div className="flex items-center justify-between text-xs leading-tight">
        <span className="text-muted-foreground uppercase tracking-wide font-medium">Forecast · {modeLabel}</span>
        <div className="flex items-center gap-2">
          {snapshot.leverageLabel && (
            <span className={`font-bold uppercase tracking-wide ${snapshot.leverageLabel === "CRITICAL" ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`}>
              {snapshot.leverageLabel}
            </span>
          )}
          <span className={`font-bold ${riskClass(snapshot.riskTag)}`}>Risk: {snapshot.riskTag}</span>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded bg-background/70 px-2 py-1">
          <span className="text-muted-foreground">K Risk </span>
          <span className={`font-semibold ${riskClass(snapshot.tilt.kRisk)}`}>{snapshot.tilt.kRisk}</span>
        </div>
        <div className="rounded bg-background/70 px-2 py-1">
          <span className="text-muted-foreground">BB Chance </span>
          <span className={`font-semibold ${riskClass(snapshot.tilt.bbPressure)}`}>{snapshot.tilt.bbPressure}</span>
        </div>
        <div className="rounded bg-background/70 px-2 py-1">
          <span className="text-muted-foreground">XBH Pressure </span>
          <span className={`font-semibold ${riskClass(snapshot.tilt.xbhPressure)}`}>{snapshot.tilt.xbhPressure}</span>
        </div>
      </div>
      {(snapshot.adaptationWarning || snapshot.fatiguePreview) && (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {snapshot.adaptationWarning && <span>{snapshot.adaptationWarning}</span>}
          {snapshot.fatiguePreview && <span>{snapshot.fatiguePreview}</span>}
        </div>
      )}
    </div>
  );
}
