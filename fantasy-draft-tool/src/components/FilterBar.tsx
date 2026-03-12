interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPosition: string;
  onPositionChange: (pos: string) => void;
  selectedType: 'batter' | 'pitcher' | 'ALL';
  onTypeChange: (type: 'batter' | 'pitcher' | 'ALL') => void;
}

const POSITIONS = {
  batter: ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'UTIL'],
  pitcher: ['SP', 'RP'],
};

export default function FilterBar({
  searchQuery,
  onSearchChange,
  selectedPosition,
  onPositionChange,
  selectedType,
  onTypeChange,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Search
        </label>
        <input
          type="text"
          placeholder="Judge, Soto, Crochet..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
        />
      </div>

      {/* Type Filter */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Player Type
        </label>
        <div className="flex gap-2">
          {(['ALL', 'batter', 'pitcher'] as const).map(type => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {type === 'ALL' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Position Filter */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Position
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onPositionChange('ALL')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedPosition === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            All
          </button>
          {selectedType === 'ALL' || selectedType === 'batter'
            ? POSITIONS.batter.map(pos => (
                <button
                  key={pos}
                  onClick={() => onPositionChange(pos)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedPosition === pos
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {pos}
                </button>
              ))
            : null}
          {selectedType === 'ALL' || selectedType === 'pitcher'
            ? POSITIONS.pitcher.map(pos => (
                <button
                  key={pos}
                  onClick={() => onPositionChange(pos)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedPosition === pos
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {pos}
                </button>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
