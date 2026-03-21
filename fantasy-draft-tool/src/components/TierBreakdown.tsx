interface TierSummary {
  tier: string;
  count: number;
  avgOps?: number;
  avgK?: number;
}

interface TierBreakdownProps {
  tiers: TierSummary[];
}

export default function TierBreakdown({ tiers }: TierBreakdownProps) {
  return (
    <div
      className="mb-8 p-6"
      style={{ background: "var(--color-surface)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <h2
        className="font-display mb-4 text-2xl font-bold uppercase text-white"
        style={{ letterSpacing: "0.04em" }}
      >
        Tier Breakdown
      </h2>
      <div className="grid grid-cols-2 gap-px md:grid-cols-3 lg:grid-cols-5">
        {tiers.map((tier) => (
          <div
            key={tier.tier}
            className="p-4 text-center"
            style={{ background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p className="font-display mb-1 text-lg font-bold uppercase text-dim">
              {tier.tier === "ELITE" ? "ELITE" : `Tier ${tier.tier}`}
            </p>
            <p className="font-data mb-2 text-3xl font-bold text-accent">
              {tier.count}
            </p>
            {tier.avgOps != null && (
              <p className="text-xs text-dim">
                Avg OPS{" "}
                <span className="font-semibold text-body">{tier.avgOps.toFixed(3)}</span>
              </p>
            )}
            {tier.avgK != null && (
              <p className="text-xs text-dim">
                Avg K{" "}
                <span className="font-semibold text-body">{tier.avgK.toFixed(0)}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
