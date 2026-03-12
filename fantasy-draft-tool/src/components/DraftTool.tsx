/**
 * React Components — UI only, consumes data layer
 */

import React, { useState, useEffect } from 'react';
import type { Player, DraftData } from '../types';
import {
  loadDraftData,
  filterByPosition,
  filterByType,
  filterByTier,
  searchByName,
  sortPlayers,
  getTierBreakdown,
} from '../lib/data';
import PlayerCard from './PlayerCard';
import TierBreakdown from './TierBreakdown';
import FilterBar from './FilterBar';

export default function DraftTool() {
  const [data, setData] = useState<DraftData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedType, setSelectedType] = useState<'batter' | 'pitcher' | 'ALL'>('ALL');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'adp' | 'ops' | 'k' | 'tier'>('tier');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Load data on mount
  useEffect(() => {
    loadDraftData()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading draft data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">Error loading data</p>
          <p className="text-slate-600 dark:text-slate-400">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  // Apply all filters
  let filtered = data.players;
  filtered = filterByType(filtered, selectedType);
  filtered = filterByPosition(filtered, selectedPosition);
  filtered = filterByTier(filtered, selectedTier);
  filtered = searchByName(filtered, searchQuery);
  filtered = sortPlayers(filtered, sortBy, sortDir);

  const tierBreakdown = getTierBreakdown(data.players);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-6 px-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">{data.league.name}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Last updated: {new Date(data.fetchedAt).toLocaleString()}
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Players</p>
            <p className="text-3xl font-bold mt-2">{data.players.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Your Pick</p>
            <p className="text-3xl font-bold mt-2">#{data.league.draftInfo.pickNumber}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Filtered Results</p>
            <p className="text-3xl font-bold mt-2">{filtered.length}</p>
          </div>
        </div>

        {/* Tier breakdown */}
        <TierBreakdown tiers={tierBreakdown} />

        {/* Filter controls */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPosition={selectedPosition}
          onPositionChange={setSelectedPosition}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedTier={selectedTier}
          onTierChange={setSelectedTier}
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
        />

        {/* Player grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">No players match your filters</p>
            </div>
          ) : (
            filtered.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
