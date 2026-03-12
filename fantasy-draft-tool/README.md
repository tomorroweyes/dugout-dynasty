# Fantasy Baseball Draft Tool

Boutique draft strategy website for the 2025 EELite League.

## Architecture

**Completely separated concerns:**

- **Data Layer** (`src/lib/data.ts`) — Pure functions, no React, handles all data fetching/filtering/sorting
- **Types** (`src/types/`) — Single source of truth for data structures
- **Components** (`src/components/`) — React UI only, consumes data layer
- **Scripts** (`scripts/build.js`) — Data generation (runs via cron at 4 AM UTC)

## Structure

```
fantasy-draft-tool/
├── src/
│   ├── types/
│   │   └── index.ts          # Data types (Player, DraftData, etc.)
│   ├── lib/
│   │   └── data.ts           # Data functions: fetch, filter, sort, tier
│   ├── components/
│   │   ├── DraftTool.tsx     # Main app container
│   │   ├── PlayerCard.tsx    # Player display
│   │   ├── TierBreakdown.tsx # Tier summary
│   │   └── FilterBar.tsx     # Filter controls
│   ├── App.tsx               # Root component
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind
├── public/
│   └── data/
│       └── draft-data.json   # Generated nightly by cron
├── scripts/
│   └── build.js              # Data generation (runs at 4 AM UTC)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── index.html
```

## Data Flow

1. **Cron Job** (4 AM UTC daily):
   - `scripts/build.js` fetches 2025 stats from Baseball Savant
   - Tiering algorithm assigns players to ELITE/1-5
   - Writes to `public/data/draft-data.json`

2. **Browser**:
   - UI loads `draft-data.json`
   - `data.ts` functions filter/sort in real-time
   - Components consume filtered results

## Setup

```bash
npm install
npm run build    # Build site + generate data
npm run dev      # Local dev server (localhost:5173)
```

## Adding Features

The separation makes iteration easy:

- **New filter?** Add to `FilterBar.tsx` + function in `data.ts`
- **New stat display?** Add to `PlayerCard.tsx` + field in `Player` type
- **New tier logic?** Change `calculateBatterTier()` in `scripts/build.js`
- **New data source?** Add fetch function in `scripts/build.js`

No component touches data generation. No data logic in components.

## Cron Integration

```javascript
// OpenClaw cron payload (runs at 4 AM UTC daily):
{
  "kind": "agentTurn",
  "message": "Run: cd /path/to/fantasy-draft-tool && npm run fetch-data && git add -A && git commit -m '[AUTO] Daily data refresh' && git push origin main",
  "timeoutSeconds": 300
}
```

## Iteration Notes

- Types are explicit to make future changes obvious
- Data functions are composable (chain filters)
- UI is purely declarative (no hidden state)
- Styling via Tailwind (easy color/layout changes)
- Dark mode built-in (extend with more theme colors)
