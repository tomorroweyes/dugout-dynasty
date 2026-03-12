import React from 'react';
import type { TierSummary } from '../lib/data';

interface TierBreakdownProps {
  tiers: TierSummary[];
}

export default function TierBreakdown({ tiers }: TierBreakdownProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Tier Breakdown</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiers.map(tier => (
          <div
            key={tier.tier}
            className="bg-slate-50 dark:bg-slate-800 rounded p-4 text-center border border-slate-200 dark:border-slate-700"
          >
            <p className="font-bold text-lg mb-1">{tier.tier === 'ELITE' ? '⭐ ELITE' : `Tier ${tier.tier}`}</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">{tier.count}</p>
            {tier.avgOps && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Avg OPS: <span className="font-semibold">{tier.avgOps.toFixed(3)}</span>
              </p>
            )}
            {tier.avgK && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Avg K: <span className="font-semibold">{tier.avgK.toFixed(0)}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
