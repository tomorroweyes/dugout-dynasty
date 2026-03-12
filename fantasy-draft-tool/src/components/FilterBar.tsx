import React from 'react';
import type { Position } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedPosition: string;
  onPositionChange: (pos: string) => void;
  selectedType: 'batter' | 'pitcher' | 'ALL';
  onTypeChange: (type: 'batter' | 'pitcher' | 'ALL') => void;
  selectedTier: string;
  onTierChange: (tier: string) => void;
  sortBy: 'name' | 'adp' | 'ops' | 'k' | 'tier';
  onSortChange: (sort: 'name' | 'adp' | 'ops' | 'k' | 'tier') => void;
  sortDir: 'asc' | 'desc';
  onSortDirChange: (dir: 'asc' | 'desc') => void;
}

const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP'];

export default function FilterBar({
  searchQuery,
  onSearchChange,
  selectedPosition,
  onPositionChange,
  selectedType,
  onTypeChange,
  selectedTier,
  onTierChange,
  sortBy,
  onSortChange,
  sortDir,
  onSortDirChange,
}: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">Filters & Sort</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium mb-2">Search Player</label>
          <input
            type="text"
            placeholder="Judge, Soto, Crochet..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Player Type</label>
          <select
            value={selectedType}
            onChange={e => onTypeChange(e.target.value as any)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Players</option>
            <option value="batter">Batters</option>
            <option value="pitcher">Pitchers</option>
          </select>
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium mb-2">Position</label>
          <select
            value={selectedPosition}
            onChange={e => onPositionChange(e.target.value)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Positions</option>
            {POSITIONS.map(pos => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>

        {/* Tier */}
        <div>
          <label className="block text-sm font-medium mb-2">Tier</label>
          <select
            value={selectedTier}
            onChange={e => onTierChange(e.target.value)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Tiers</option>
            <option value="ELITE">⭐ ELITE</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
            <option value="4">Tier 4</option>
            <option value="5">Tier 5</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as any)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="tier">Tier</option>
            <option value="adp">ADP</option>
            <option value="ops">OPS (Batters)</option>
            <option value="k">Strikeouts (Pitchers)</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Sort Direction */}
        <div>
          <label className="block text-sm font-medium mb-2">Direction</label>
          <select
            value={sortDir}
            onChange={e => onSortDirChange(e.target.value as any)}
            className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
    </div>
  );
}
