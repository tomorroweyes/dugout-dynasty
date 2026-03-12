import React, { useState, useEffect } from 'react';
import type { Player, DraftData } from '../types';
import {
  loadDraftData,
  filterByPosition,
  filterByType,
  getTierBreakdown,
} from '../lib/data';
import PlayerCard from './PlayerCard';
import FilterBar from './FilterBar';

const POSITIONS = {
  batter: ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'UTIL'],
  pitcher: ['SP', 'RP'],
};

export default function DraftTool() {
  const [data, setData] = useState<DraftData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedType, setSelectedType] = useState<'batter' | 'pitcher' | 'ALL'>('ALL');

  useEffect(() => {
    loadDraftData()
      .then(setData)
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading players...</div>;
  if (error || !data) return <div className="p-8 text-center text-red-500">Error loading data</div>;

  // Filter players
  let filtered = data.players;
  
  if (selectedType !== 'ALL') {
    filtered = filterByType(filtered, selectedType);
  }
  if (selectedPosition !== 'ALL') {
    filtered = filterByPosition(filtered, selectedPosition);
  }
  if (searchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Group by tier
  const tiers = ['ELITE', '1', '2', '3', '4', '5'];
  const playersByTier = tiers.reduce((acc, tier) => {
    acc[tier] = filtered.filter(p => p.tier === tier);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            2025 EELite League
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-16 z-9">
        <div className="max-w-7xl mx-auto">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedPosition={selectedPosition}
            onPositionChange={setSelectedPosition}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
          />
        </div>
      </div>

      {/* Tier Breakdown */}
      <div className="bg-white dark:bg-slate-950 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {tiers.map(tier => {
              const count = playersByTier[tier].length;
              const tierColors: Record<string, string> = {
                ELITE: 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100',
                '1': 'bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100',
                '2': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100',
                '3': 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100',
                '4': 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
                '5': 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100',
              };
              return (
                <div key={tier} className={`p-4 rounded-lg ${tierColors[tier]}`}>
                  <div className="text-lg font-bold">Tier {tier}</div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs opacity-75">players</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Players by Tier */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-12">
          {tiers.map(tier => {
            const tierPlayers = playersByTier[tier];
            if (tierPlayers.length === 0) return null;

            const tierColors: Record<string, string> = {
              ELITE: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950',
              '1': 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950',
              '2': 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950',
              '3': 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950',
              '4': 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950',
              '5': 'border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950',
            };

            return (
              <div key={tier} className={`border-l-4 pl-6 py-4 rounded ${tierColors[tier]}`}>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                  Tier {tier} ({tierPlayers.length} players)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tierPlayers.map(player => (
                    <PlayerCard key={player.mlbId} player={player} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
