import { useEffect, useState } from "react";
import type { InsightCard } from "@/engine/postMatchInsights";
import { Button } from "@/components/ui/8bit/button";

interface PostMatchInsightCardsProps {
  insights: InsightCard[];
  emphasized?: boolean;
  defaultExpanded?: boolean;
  onViewed?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export function PostMatchInsightCards({
  insights,
  emphasized = false,
  defaultExpanded = false,
  onViewed,
  onExpandedChange,
}: PostMatchInsightCardsProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    onViewed?.();
  }, [onViewed]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <div
      className={`w-full rounded border p-3 text-left ${
        emphasized
          ? "border-red-400/50 bg-red-950/20"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Post-Match Insights
          </p>
          <p className="text-sm font-semibold">Cause & Effect Summary</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleToggle}>
          {expanded ? "Hide" : "Show"}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {insights.map((insight, index) => (
            <div key={`${insight.triggerType}-${index}`} className="rounded border border-border/70 bg-background/60 p-2">
              <p className="text-xs text-muted-foreground">Trigger</p>
              <p className="text-sm font-medium">{insight.trigger}</p>

              <p className="mt-1 text-xs text-muted-foreground">Ripple</p>
              <p className="text-sm">{insight.ripple}</p>

              <p className="mt-1 text-xs text-muted-foreground">Outcome</p>
              <p className="text-sm">{insight.outcome}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
