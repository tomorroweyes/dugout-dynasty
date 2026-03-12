import React from 'react';
import type { Player } from '../types';

const tierColors: Record<string, string> = {
  ELITE: 'bg-tier-elite',
  '1': 'bg-tier-1',
  '2': 'bg-tier-2',
  '3': 'bg-tier-3',
  '4': 'bg-tier-4',
  '5': 'bg-slate-400',
};

const tierBorders: Record<string, string> = {
  ELITE: 'border-tier-elite',
  '1': 'border-tier-1',
  '2': 'border-tier-2',
  '3': 'border-tier-3',
  '4': 'border-tier-4',
  '5': 'border-slate-400',
};

interface PlayerCardProps {
  player: Player;
}

export default function PlayerCard({ player }: PlayerCardProps) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border-2 ${tierBorders[player.tier]} rounded-lg p-4 flex flex-col`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-lg">{player.name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {player.position}
            {player.positions && player.positions.length > 0
              ? ` / ${player.positions.join('/')}`
              : ''}
          </p>
        </div>
        <div
          className={`${tierColors[player.tier]} text-white font-bold px-2 py-1 rounded text-sm`}
        >
          {player.tier}
        </div>
      </div>

      {/* Injury status */}
      {player.injured && (
        <div className="mb-2 px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 text-xs rounded flex items-center gap-1">
          <span>⚠</span>
          <span>{player.injuryStatus || 'Injured'}</span>
        </div>
      )}

      {/* Stats */}
      <div className="mb-3 text-sm space-y-1">
        {player.batting && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">OPS</span>
              <span className="font-semibold">{player.batting.ops.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">HR</span>
              <span className="font-semibold">{player.batting.hr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">R</span>
              <span className="font-semibold">{player.batting.r}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">SB</span>
              <span className="font-semibold">{player.batting.sb}</span>
            </div>
          </>
        )}
        {player.pitching && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">K%</span>
              <span className="font-semibold">{player.pitching.kpct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">K</span>
              <span className="font-semibold">{player.pitching.k}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">ERA</span>
              <span className="font-semibold">{player.pitching.era?.toFixed(2) || 'N/A'}</span>
            </div>
          </>
        )}
      </div>

      {/* ADP */}
      {player.adp && (
        <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 text-xs rounded">
          ADP: {player.adp.toFixed(0)}
        </div>
      )}

      {/* Notes */}
      {player.notes && player.notes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          {player.notes.map((note, i) => (
            <p key={i}>• {note}</p>
          ))}
        </div>
      )}
    </div>
  );
}
