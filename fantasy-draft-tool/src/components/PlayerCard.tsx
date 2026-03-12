import type { Player } from '../types';

interface Props {
  player: Player;
}

export default function PlayerCard({ player }: Props) {
  const isBatter = player.type === 'batter';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 hover:shadow-lg dark:hover:shadow-xl transition-shadow">
      {/* Name and Position */}
      <div className="mb-3">
        <div className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
          {player.name}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          {player.position}
        </div>
      </div>

      {/* Key Stats */}
      <div className="space-y-2 text-sm">
        {isBatter ? (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">OPS</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.ops ? player.ops.toFixed(3) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">HR</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.homeRuns ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">SB</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.stolenBases ?? '—'}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">K</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.strikeouts ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">ERA</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.era ? player.era.toFixed(2) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">WHIP</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {player.whip ? player.whip.toFixed(3) : '—'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ADP */}
      {player.adp && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-500">ADP</span>
            <span className="font-bold text-slate-900 dark:text-white">
              #{Math.round(player.adp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
