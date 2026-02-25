# Dugout Dynasty - Complete Codebase Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Implemented Systems & Architecture](#2-implemented-systems--architecture)
3. [Data Models & Types](#3-data-models--types)
4. [Key Components](#4-key-components)
5. [Game Mechanics & Simulation](#5-game-mechanics--simulation)
6. [State Management](#6-state-management)
7. [UI Structure](#7-ui-structure)
8. [Configuration & Constants](#8-configuration--constants)
9. [Utility Functions](#9-utility-functions)
10. [Architectural Patterns](#10-architectural-patterns)

---

## 1. Project Overview

**Dugout Dynasty** is a browser-based baseball management RPG combining sports simulation with RPG character management mechanics. The core premise is "Moneyball meets RPG" - players manage a roster of baseball players with leveled stats, stamina systems, and strategic rotation mechanics.

### Key Features
- Team management with 14 players (13 batters + 3 pitchers)
- Full 9-inning baseball match simulation with box scores and play-by-play
- Multi-tier league system (Sandlot → Local → Regional → National → World)
- Stamina-based fatigue system with graduated performance penalties
- AI opponent generation and AI vs AI match simulation
- Career progression with seasonal league play
- Persistent save system with migrations
- Theme support (light/dark mode)

### Tech Stack
- **React 19** + **TypeScript 5.6**
- **Zustand 5** for state management
- **Tailwind CSS 4** with custom 8-bit theme
- **Vite 6** for build tooling
- **Faker.js 9** for player name generation
- **Vitest 4** for testing (13 test files, 39 component files)

---

## 2. Implemented Systems & Architecture

### 2.1 Game Engine (`src/engine/`)

The engine is the core simulation layer handling all game mechanics:

#### Core Components

**matchEngine.ts** - Main baseball simulation engine
- Simulates 9-inning games with full box score tracking
- Handles pitcher rotation (starter → reliever progression)
- Tracks individual player statistics (batters and pitchers)
- Implements base running and run scoring logic
- Supports both human and AI team configurations

**atBatSimulator.ts** - Individual at-bat resolution
- Calculates effective player stats (with stamina and fatigue penalties)
- Determines at-bat outcomes (strikeout, walk, hit types, outs)
- Applies pitcher fatigue (within-game effectiveness loss)
- Uses probability-based outcome determination

**outcomeConfig.ts** - Outcome resolution system
- Configuration-driven outcome definitions with base advancement rules
- Handles runner advancement logic for all play types
- Calculates RBIs and runs scored
- Maps outcomes to display text and UI colors

**gameModifiers.ts** - Stats modifier system
- Graduated stamina penalty curve (75-100: 0%, 55-74: 7%, 35-54: 18%, 15-34: 32%, 0-14: 50%)
- Pitcher fatigue modifiers (5% effectiveness loss per inning, 70% minimum)
- Momentum modifier (extensible framework)
- Recovery multiplier curve with diminishing returns

**playerGenerator.ts** - Player creation
- Generates players with tier-based stats (ROOKIE, AVERAGE, SOLID, GOOD, STAR, ELITE)
- Uses Faker.js for realistic names
- Calculates salary based on overall rating
- Supports team generation by quality tier

**constants.ts** - Central game balance configuration
- Stamina system (role-specific drain/recovery rates)
- At-bat probability constants
- Pitcher rotation rules
- League tier definitions with opponent strength multipliers
- AI personality presets

**statConfig.ts** - Stat validation and metadata
- Defines stat ranges for batters and pitchers
- Stat tier classification (POOR to ELITE)
- Overall rating calculations
- Color tier mapping for UI display
- Validation utilities for stat values

**randomProvider.ts** - Dependency-injected randomness
- `MathRandomProvider` - Default Math.random() wrapper
- `SeededRandomProvider` - Deterministic LCG for reproducible matches
- `MockRandomProvider` - Fixed values for testing
- Enables testability without global Math.random dependency

### 2.2 League System (`src/engine/`)

**leagueGenerator.ts** - Season and league creation
- Generates opponent teams with tier-appropriate stats
- Creates round-robin schedules for each tier
- Assigns AI personalities to opponent teams
- Generates team colors and names using Faker

**aiRotation.ts** - AI roster management logic
- Calculates effective player value with stamina adjustments
- Applies personality-driven rotation decisions
- Dynamic thresholds based on match importance
- Selects optimal lineups considering player ratings and fatigue

**aiMatchSimulator.ts** - AI vs AI match execution
- Simulates matches between two AI teams
- Applies rotation decisions before match
- Tracks stamina changes for all players
- Updates standings after match completion

### 2.3 Service Layer (`src/services/`)

**GameController.ts** - Business logic orchestration
- Generates new teams with proper roster composition
- Calculates team strength ratings
- Orchestrates match preparation and execution
- Manages stamina updates after matches
- Implements auto-rotation for player rosters
- Handles player swaps between lineup/bench

**LeagueController.ts** - Season progression management
- Initializes seasons in specific tiers
- Simulates all non-player AI matches in a week
- Calculates standings and promotion/relegation
- Handles season completion and rewards

### 2.4 State Management (`src/store/`)

**gameStore.ts** - Primary Zustand store
- Persisted to localStorage with migrations
- **State:**
  - `team` - Current player team with roster, lineup, bench
  - `matchLog` - Historical match results
  - `league` - Current league state
  - `currentTier` - Active league tier
  - `career` - Career statistics across seasons
- **Actions:**
  - `initializeGame()` - Start new season
  - `playWeekMatch()` - Play scheduled match
  - `completeWeek()` - Simulate AI matches and advance
  - `advanceToNextSeason()` - Promotion/relegation logic
  - `swapPlayers()` - Lineup/bench management
  - `autoFix()` - Optimize roster for next match

**settingsStore.ts** - Separate Zustand store for user settings
- Persisted independently to localStorage
- **Settings:**
  - `autoRotatePitchers` - Automatic pitcher rotation

### 2.5 Utilities (`src/utils/`)

**staminaUtils.ts** - Stamina display and prediction
- Visual state mapping (FRESH, MINOR_FATIGUE, TIRED, HEAVY_FATIGUE, EXHAUSTED)
- Performance multiplier calculations
- Stamina drain/recovery predictions
- Stamina display formatting

**seededRandom.ts** - Legacy seeded random (ShiftRng)
**saveValidation.ts** - Save file validation schemas
**saveMigrations.ts** - Version-based save migrations

### 2.6 Configuration (`src/config/`)

**saveConfig.ts** - Save system configuration
- Storage keys and version management
- Auto-save settings (500ms debounce)
- Corruption recovery policies
- Future: multi-slot saves

---

## 3. Data Models & Types

Located in `src/types/`:

### 3.1 Game Types (`game.ts`)

```typescript
// Player role-specific stats
BatterStats { power, contact, glove }
PitcherStats { velocity, control, break }

// Player entity
Player {
  id, name, role, stats, stamina: {current, max}, salary
}
// Roles: "Batter" | "Starter" | "Reliever"

// Team (used for both player and AI teams)
Team {
  id, cash, fans, roster[], lineup[], bench[], wins, losses
}

// Match results and statistics
MatchResult {
  myRuns, opponentRuns, isWin, cashEarned, totalInnings,
  boxScore?, playByPlay?
}

BoxScore {
  myBatters[], myPitchers[], opponentBatters[], opponentPitchers[],
  myHits, opponentHits
}

PlayerBoxScore { playerId, name, atBats, hits, runs, rbis, strikeouts, walks }
PitcherBoxScore { playerId, name, inningsPitched, hitsAllowed, runsAllowed, strikeouts, walks }

PlayOutcome (12 types)
| "strikeout" | "walk" | "single" | "double" | "triple" | "homerun"
| "groundout" | "flyout" | "lineout" | "popout" | "out"

PlayByPlayEvent {
  inning, isTop, batter, pitcher, outcome, rbi?, outs
}

// Type guards
isBatter(player): player is Player & { stats: BatterStats }
isPitcher(player): player is Player & { stats: PitcherStats }
```

### 3.2 League Types (`league.ts`)

```typescript
LeagueTier = "SANDLOT" | "LOCAL" | "REGIONAL" | "NATIONAL" | "WORLD"

AIPersonality {
  aggression: 0-1,           // Willing to play tired stars
  depthFocus: 0-1,           // Prefer deep bench vs star players
  restDiscipline: 0-1        // Strictness of rest thresholds
}

OpponentTeam extends Team {
  id, name, city, mascot, tier, aiPersonality, colors
}

League {
  id, tier, season, teams[], humanTeamId,
  schedule, standings, currentWeek, totalWeeks,
  isComplete, seasonResult?
}

ScheduledMatch {
  homeTeamId, awayTeamId, completed, result?
}

StandingsEntry {
  teamId, teamName, wins, losses, runsScored, runsAllowed, streak
}

SeasonResult {
  finalPosition, totalWins, totalLosses,
  cashPrize, scoutPoints, fanBonus,
  promoted, relegated, nextTier?
}

CareerStats {
  totalSeasons, totalWins, totalLosses, championshipsWon, tournamentsWon,
  highestTierReached, historicalRecords[]
}
```

### 3.3 Settings Types (`settings.ts`)

```typescript
UserSettings {
  autoRotatePitchers: boolean
  // Future: autoRestTiredPlayers, difficultyLevel, etc.
}

SettingMetadata {
  key, label, description, category, type, options?
}
```

### 3.4 Save Types (`save.ts`)

```typescript
SaveData {
  version, timestamp, gameVersion,
  state: {
    team, matchLog, league, currentTier, career
  },
  metadata?: { playtime, achievements }
}

MatchLogEntry extends MatchResult {
  timestamp, opponent?
}
```

---

## 4. Key Components

### 4.1 Top-Level Component (`App.tsx`)

- Tab-based navigation system (League, Roster, Match Log, Settings)
- Game initialization and reset
- Display of key stats (cash, fans, win-loss record)
- Season results modal when league completes
- Light/dark theme toggle

### 4.2 League Management Components

**LeagueView.tsx** - Main league interface
- Displays current tier name and season progress
- Shows current week schedule
- Buttons to play match or simulate rest of week
- Standings table
- Schedule view with team matchups

**StandingsTable.tsx** - League standings
- Displays all teams with records
- Shows runs scored/allowed (tiebreaker stats)
- Current win/loss streaks
- Highlights player's team

**ScheduleView.tsx** - Weekly schedule
- Shows all matches for current week
- Indicates completion status
- Highlights player's match
- Shows team colors and mascots

### 4.3 Roster Management Components

**RosterPanel.tsx** - Lineup and bench management
- Displays lineup (12 players) split by role (batters, starters, relievers)
- Shows bench players
- Average stamina indicator with color coding
- "Auto-Fix" button to optimize roster
- Player swap functionality

**PlayerCard.tsx** - Individual player display
- Shows name, role, stats (with color-coding by tier)
- Visual stamina bar with state indicators
- Overall rating and effective rating (with stamina penalties)
- Character sheet modal on click
- Lineup/Bench swap button

**CharacterSheet.tsx** - Detailed player information
- Full stat breakdown with descriptions
- Stamina visualization with performance impact
- Role icon and salary
- Expandable stat tiers and meanings

**StaminaBar.tsx** - Visual stamina indicator
- Percentage-based fill bar
- Color-coded by stamina state (fresh/fatigued/exhausted)
- Tooltip showing performance multiplier

### 4.4 Match and Results Components

**MatchPanel.tsx** - Match log view wrapper
- Displays match history

**MatchLog.tsx** - Historical match display
- Shows last N matches with expandable details
- Win/loss badges with cash earned
- Modal triggers for box score and play-by-play

**BoxScore.tsx** - Game statistics display
- Batter statistics (AB, H, R, RBI, K, BB)
- Pitcher statistics (IP, H, R, K, BB)
- Separated by team (player vs opponent)

**PlayByPlay.tsx** - Inning-by-inning breakdown
- Shows each play with outcome
- Batter and pitcher names
- RBI highlights
- Inning and outs tracking

**GameDetailsModal.tsx** - Match detail viewer
- Modal container for box score and play-by-play
- Tabs for different views
- Score summary

### 4.5 Settings and Display Components

**SettingsPanel.tsx** - User preferences
- Auto-rotation pitcher toggle
- Future extensibility for additional settings
- Reset to defaults button

**StatDisplay.tsx** - Generic stat badge
- Icon + label + value
- Used in header for cash, fans, record

**ThemeToggle.tsx** - Dark/light mode switch
- Uses theme provider
- System preference detection

### 4.6 UI Component Library (`src/components/ui/`)

**Two-tier UI System:**

1. **Standard Components** (Shadcn UI)
   - card, button, badge, progress, separator, tabs, table, avatar, label

2. **8-bit Theme Variants** (`src/components/ui/8bit/`)
   - Retro pixel-art styled versions of all components
   - Pixel borders and fonts
   - Different visual aesthetic option

---

## 5. Game Mechanics & Simulation

### 5.1 Stamina System (Core Mechanic)

**Role-Specific Drain & Recovery:**
- **Batters:** -10 per game (lineup), +38 per match (bench recovery)
- **Starters:** -30 per game (lineup), +20 per match (bench recovery)
- **Relievers:** -18 per game (lineup), +26 per match (bench recovery)

**Graduated Penalty Curve:**
- 75-100: 100% performance (FRESH)
- 55-74: 93% performance (MINOR_FATIGUE, 7% penalty)
- 35-54: 82% performance (TIRED, 18% penalty)
- 15-34: 68% performance (HEAVY_FATIGUE, 32% penalty)
- 0-14: 50% performance (EXHAUSTED)

**Recovery Multiplier Curve:**
- At 0 stamina: 1.4x recovery (fast recovery when exhausted)
- At 50 stamina: 1.1x recovery
- At 75+ stamina: 0.9x recovery (slower near full)
- Prevents instant full recovery, encourages gradual restoration

### 5.2 Match Simulation (Baseball Rules)

**Inning Structure:**
- 9 total innings
- Alternating top (opponent offense) and bottom (player offense) halves
- 3 outs per inning per team
- Play continues until both teams have taken their turn

**At-Bat Resolution:**
1. Get effective batter and pitcher stats (with stamina/fatigue)
2. Calculate strikeout and walk probabilities
3. Roll for outcome type (walk, strikeout, or ball-in-play)
4. If ball-in-play: calculate hit type based on power/velocity/glove
5. Apply outcome: advance bases, score runs, record stats

**Hit Type Determination (Ball-In-Play):**
- Pitcher velocity, control, break vs batter power, contact
- Hit roll (0-100) determines outcome:
  - 90+: Home Run
  - 82-89: Triple
  - 70-81: Double
  - 60-69: Single
  - <60: Out with type distribution (45% ground, 35% fly, 12% line, 8% pop)

**Base Running:**
- Configured advancement rules per outcome type
- Forced runners advance only on walks
- Automatic scoring on home runs
- Complex scoring logic for multibases hits with loaded bases

**Pitcher Rotation (Within-Game):**
- Starter pitches innings 0-4 (5 innings max)
- First reliever enters inning 5
- Second reliever enters inning 7
- Pitcher fatigue: -5% effectiveness per inning (70% minimum)

**Team Strength Scaling:**
- Opponents generated at 0.9-1.1x player team strength
- Ensures ~50% win rate regardless of team power level
- Dynamic difficulty that grows with player progression

### 5.3 Auto-Rotation System (Pitcher Management)

**Starter Rotation Rule (REST_THRESHOLD: 75):**
- If starter stamina < 75, bench them (they just pitched and lost 30 stamina)
- Ensures starters never pitch consecutive games
- Fresh reliever selected as replacement

**Reliever Rotation Rule (REST_THRESHOLD: 55):**
- If reliever stamina < 55 (TIRED threshold), bench them
- Prevents "tired" pitchers in lineup (18% performance penalty)
- Fresh reliever from bench selected

**Replacement Priority:**
1. Highest effective value (base rating × stamina multiplier)
2. Tiebreaker: higher stamina (fresher)

**AI Personality Variations:**
- **Aggressive:** Lower discipline, will play tired stars (aggression: 0.8, restDiscipline: 0.4)
- **Balanced:** Follows thresholds (aggression: 0.5, restDiscipline: 0.7)
- **Conservative:** Strict rest (aggression: 0.2, restDiscipline: 0.9)
- **Star-Driven:** Risk stars over depth (aggression: 0.9, depthFocus: 0.2)
- **Depth-Focused:** Preserve stars, use bench (aggression: 0.3, depthFocus: 0.9)

### 5.4 League System (Multi-Tier Progression)

**5 Tiers with Increasing Difficulty:**

| Tier | Name | Teams | Games | Opponent Strength | Cash Prize | Points/Win | Promotion |
|------|------|-------|-------|-------------------|------------|-----------|-----------|
| SANDLOT | Sandlot League | 4 | 9 | 0.95-1.05 | $2,000 | 1 | Top 2 → LOCAL |
| LOCAL | Local League | 6 | 10 | 1.0-1.1 | $5,000 | 2 | Top 2 → REGIONAL |
| REGIONAL | Regional League | 8 | 14 | 1.05-1.2 | $10,000 | 3 | Top 2 → NATIONAL |
| NATIONAL | National League | 10 | 18 | 1.15-1.3 | $20,000 | 5 | Top 2 → WORLD |
| WORLD | World Championship | 12 | 22 | 1.25-1.5 | $50,000 | 10 | (Top tier) |

**Season Results:**
- Final position determines promotion/relegation
- Cash and scout point rewards based on placement
- Fan multiplier growth per win
- Championship completion unlocks next tier

**Career Tracking:**
- Total seasons played
- Total wins/losses across career
- Championships and tournaments won
- Highest tier reached
- Historical records (championship game stats)

### 5.5 Match Outcome System (10 Outcome Types)

Centralized in `outcomeConfig.ts` with base advancement rules:

| Outcome | Display | At-Bat? | Hit? | Out? | Base Advancement |
|---------|---------|---------|------|------|------------------|
| Walk | Batter walks | No | No | No | Force advance |
| Strikeout | Batter K | Yes | No | Yes | None |
| Single | Single | Yes | Yes | No | 1B, 2B→3B, 3B→Home |
| Double | Double | Yes | Yes | No | 2B, 2B→Home, 3B→Home |
| Triple | Triple | Yes | Yes | No | 3B, 2B→Home, 3B→Home |
| Home Run | Home Run | Yes | Yes | No | All home |
| Ground Out | Ground out | Yes | No | Yes | None |
| Fly Out | Fly out | Yes | No | Yes | None |
| Line Out | Line out | Yes | No | Yes | None |
| Pop Out | Pop out | Yes | No | Yes | None |

---

## 6. State Management

### 6.1 Zustand + Persist Middleware

**gameStore.ts**
- Single root store managing all game state
- Persisted to localStorage with key: `dustycleats-save-v1`
- Automatic save on state changes (debounced in future)
- Manual save/load via API

**Architecture:**
```
GameState (in-memory)
    ↓
    ├─ team: Team (player team state)
    │   ├─ roster: Player[]
    │   ├─ lineup: string[] (IDs)
    │   ├─ bench: string[] (IDs)
    │   ├─ cash, fans, wins, losses
    │
    ├─ league: League | null (current season)
    │   ├─ teams: OpponentTeam[] (all league teams)
    │   ├─ schedule: MatchSchedule
    │   ├─ standings: StandingsEntry[]
    │   ├─ currentWeek, totalWeeks
    │   ├─ isComplete, seasonResult
    │
    ├─ matchLog: MatchLogEntry[] (history)
    │
    ├─ currentTier: LeagueTier (active tier)
    │
    ├─ career: CareerStats (multi-season data)
    │
    └─ Actions (business logic)
        ├─ initializeGame()
        ├─ playWeekMatch()
        ├─ completeWeek()
        ├─ advanceToNextSeason()
        ├─ swapPlayers()
        ├─ autoFix()
        └─ resetGame()
```

**settingsStore.ts**
- Separate small store for user preferences
- Persisted independently: `dustycleats-settings`
- Doesn't require game initialization

### 6.2 State Flow

```
User Action (App UI)
    ↓
Component calls store action (e.g., playWeekMatch)
    ↓
Action calls GameController service
    ↓
Controller orchestrates engine components
    ↓
Engine returns result (MatchResult, staminaUpdates, etc.)
    ↓
Action updates store state
    ↓
Zustand triggers re-render
    ↓
Component reflects new state
    ↓
localStorage auto-saved
```

### 6.3 Save System

**Validation & Migration:**
- SaveData type guard validates structure before loading
- Version-based migrations handle schema changes
- Corrupt saves trigger reset to new game (RESET_ON_CORRUPT: true)
- Validation runs on both save and load

**Future Enhancements:**
- Auto-save debouncing (500ms)
- Backup system for previous saves
- Multi-slot saves

---

## 7. UI Structure

### 7.1 Page Navigation (Tab-Based)

```
App.tsx
    ├─ League Tab
    │   ├─ LeagueView
    │   │   ├─ League header (tier, season, week)
    │   │   ├─ ScheduleView (current week matches)
    │   │   ├─ Action buttons (Play/Simulate)
    │   │   └─ StandingsTable (league standings)
    │   │
    │   └─ SeasonResultsView (if season complete)
    │       ├─ Final position and rewards
    │       ├─ Promotion/relegation status
    │       └─ Continue button
    │
    ├─ Roster Tab
    │   ├─ RosterPanel
    │   │   ├─ Lineup section (by role)
    │   │   ├─ Bench section
    │   │   ├─ Average stamina display
    │   │   ├─ Auto-Fix button
    │   │   └─ PlayerCard[] (clickable for details)
    │   │
    │   └─ PlayerCard (per player)
    │       ├─ Name and role
    │       ├─ Stat display (power, velocity, etc.)
    │       ├─ Stamina bar
    │       ├─ Overall/effective rating
    │       ├─ Lineup/Bench button
    │       └─ Click → CharacterSheet modal
    │
    │   CharacterSheet Modal
    │   ├─ Full stat breakdown
    │   ├─ Stamina visualization
    │   ├─ Role and salary
    │   └─ Stat tier explanations
    │
    ├─ Match Log Tab
    │   └─ MatchLog
    │       ├─ Match list (last N games)
    │       ├─ Win/loss badge per match
    │       ├─ Cash earned display
    │       ├─ Expandable match details
    │       │
    │       └─ GameDetailsModal
    │           ├─ BoxScore tab
    │           │   ├─ Batter stats (AB, H, R, RBI, K, BB)
    │           │   └─ Pitcher stats (IP, H, R, K, BB)
    │           │
    │           └─ PlayByPlay tab
    │               ├─ Inning-by-inning breakdown
    │               ├─ Batter × Pitcher × Outcome
    │               └─ RBI highlighting
    │
    └─ Settings Tab
        └─ SettingsPanel
            ├─ Auto-Rotate Pitchers toggle
            ├─ Reset to Defaults button
            └─ Future: Difficulty, animations, etc.
```

### 7.2 Header (Persistent)

- Game title ("Dugout Dynasty")
- Key stats display:
  - 💰 Cash balance
  - 👥 Fan multiplier (1.0x, 1.5x, etc.)
  - 📊 Win-Loss record
- Theme toggle (light/dark)
- Reset button (with confirmation)

### 7.3 Responsive Design

- Mobile: Stack vertically
- Tablet (768px+): 2-column layout possible
- Desktop (1024px+): Full layout with multiple panels
- Container-based responsive classes

### 7.4 Color System

**Stat Tier Colors** (from [statConfig.ts](src/engine/statConfig.ts)):
- **ELITE:** Purple (text-purple-600, bg-purple-100)
- **GREAT:** Blue (text-blue-600, bg-blue-100)
- **GOOD:** Green (text-green-600, bg-green-100)
- **SOLID:** Teal (text-teal-600, bg-teal-100)
- **AVERAGE:** Gray (text-gray-600, bg-gray-100)
- **POOR:** Red (text-red-600, bg-red-100)

**Stamina State Colors:**
- Tied to stat tier colors for consistency
- Icon + text color indicates performance level

**Theme Support:**
- Tailwind dark mode auto-detects system preference
- Custom CSS variables for 8-bit theme variant

---

## 8. Configuration & Constants

### 8.1 Game Constants ([engine/constants.ts](src/engine/constants.ts)) - ~300 lines

**Stamina Configuration:**
- Role-based drain rates (Batter: 10, Starter: 30, Reliever: 18)
- Role-based recovery rates (Batter: 38, Starter: 20, Reliever: 26)
- Graduated thresholds (FRESH: 75, MINOR_FATIGUE: 55, TIRED: 35, HEAVY_FATIGUE: 15)
- Performance multipliers (1.0, 0.93, 0.82, 0.68, 0.50)

**Recovery Curve:**
- Diminishing returns interpolation
- At 0: 1.4x multiplier (exhausted recover fast)
- At 50: 1.1x multiplier
- At 75: 0.9x multiplier (nearly fresh = slow recovery)

**Match Rewards:**
- Win: $500 base
- Loss: $250 consolation
- Multiplied by fan multiplier

**At-Bat Probabilities:**
- Strikeout divisor: 1.8 (lower = more strikeouts)
- Walk divisor: 4 (lower = more walks)
- Batter score multiplier: 1.2
- Pitcher score multiplier: 0.9
- Defense score multiplier: 0.8

**Hit Outcome Thresholds (hitRoll 0-100):**
- Home Run: 90+
- Triple: 82+
- Double: 70+
- Single: 60+
- Out: <60 (45% groundout, 35% flyout, 12% lineout, 8% popout)

**Pitcher Fatigue (Within-Game):**
- 5% effectiveness loss per inning
- 70% minimum effectiveness

**Pitcher Rotation:**
- Starter max: 5 innings
- First reliever enters: inning 5
- Second reliever enters: inning 7

**Opponent Generation:**
- Strength variance: 0.9-1.1x (ensures balanced matches)

**Auto-Rotation Thresholds:**
- Starter rest threshold: 75 stamina
- Reliever rest threshold: 55 stamina

**League Tiers Configuration:**
Each tier defines:
- Team count
- Games per opponent
- Opponent strength range
- Reward structure (cash, points, fan growth)
- Promotion/relegation slots

**AI Personalities:**
5 presets with aggression, depthFocus, restDiscipline values

### 8.2 Stat Configuration ([engine/statConfig.ts](src/engine/statConfig.ts)) - ~360 lines

**Stat Ranges (0-100):**
- Batter: Power, Contact, Glove
- Pitcher: Velocity, Control, Break

**Stat Tiers:**
- POOR (0-30), AVERAGE (30-45), SOLID (45-60), GOOD (60-75), GREAT (75-87), ELITE (87-100)

**Player Generation Templates:**
6 quality tiers (ROOKIE → ELITE) with stat ranges per tier
- ROOKIE: 15-35 range per stat
- ELITE: 85-98 range per stat

**Overall Rating Calculations:**
- Batter: (Power × 0.4 + Contact × 0.4 + Glove × 0.2)
- Pitcher: (Velocity × 0.35 + Control × 0.35 + Break × 0.3)

**Stat Tier Colors & Styling:**
Consistent color mapping across all components

### 8.3 Save Configuration ([config/saveConfig.ts](src/config/saveConfig.ts))

```typescript
STORAGE_KEY: 'dugout-dynasty-save'
CURRENT_VERSION: '1.0.0'
AUTO_SAVE_ENABLED: true
AUTO_SAVE_DEBOUNCE_MS: 500
VALIDATE_ON_SAVE: true
VALIDATE_ON_LOAD: true
RESET_ON_CORRUPT: true
MAX_SAVE_SLOTS: 1 (future: multi-slot)
```

---

## 9. Utility Functions

### 9.1 Stamina Utilities ([utils/staminaUtils.ts](src/utils/staminaUtils.ts))

- `getStaminaState()` - Returns visual state object with tier, label, icon, color
- `getPerformanceMultiplier()` - Returns 0.5-1.0 multiplier
- `getStaminaDrainForRole()` - Returns drain amount by role
- `predictStaminaAfterGame()` - Calculates next stamina after playing
- `formatStaminaDisplay()` - Returns formatted value and performance strings

### 9.2 Game Modifiers ([engine/gameModifiers.ts](src/engine/gameModifiers.ts))

- `applyStaminaPenalty()` - Applies graduated stamina multiplier to stat
- `applyPitcherFatigue()` - Applies inning-based fatigue to stat
- `applyPitcherModifiers()` - Chains stamina + fatigue modifiers
- `getStaminaDrain()` - Role-based drain lookup
- `getStaminaRecovery()` - Role-based recovery lookup
- `calculateStaminaRecovery()` - Applies recovery curve with diminishing returns

### 9.3 Random Provider ([engine/randomProvider.ts](src/engine/randomProvider.ts))

Implementations of RandomProvider interface:
- `MathRandomProvider` - Math.random() wrapper
- `SeededRandomProvider` - LCG-based deterministic randomness
- `MockRandomProvider` - Fixed values for testing
- Global provider management functions

### 9.4 Save Utilities

- `validateSaveData()` - Type guards and schema validation
- `sanitizeSaveData()` - Removes invalid fields
- `migrateSaveData()` - Version-based migrations (future extensible)

### 9.5 Component Utilities ([lib/utils.ts](src/lib/utils.ts))

- `cn()` - ClassNames merge utility (clsx + tailwind-merge)

---

## 10. Architectural Patterns

### 10.1 Design Patterns

1. **Service Layer Pattern**
   - GameController and LeagueController separate business logic from state
   - Zustand store delegates to services, avoiding fat stores
   - Services handle orchestration, validation, calculations

2. **Dependency Injection (RandomProvider)**
   - RandomProvider interface allows swapping implementations
   - MathRandomProvider for production, SeededRandomProvider for testing
   - MockRandomProvider for deterministic test scenarios
   - Enables reproducible match replay with seeds

3. **Configuration-Driven Outcomes**
   - [outcomeConfig.ts](src/engine/outcomeConfig.ts) defines all play outcomes declaratively
   - Base advancement rules as composable functions
   - Display text + variants for variety
   - Extensible for new outcome types

4. **Type Guards (Discriminated Unions)**
   - `isBatter()` and `isPitcher()` provide type narrowing
   - Enables role-specific stat access without casting
   - Prevents type errors when working with Player[]

5. **Event Emitter (Pub/Sub)**
   - gameEvents.GameEventEmitter for decoupled features
   - Supports at-bat events, inning events, match events
   - Foundation for animations, sounds, achievements (future)

6. **Persistent Store with Versioning**
   - Zustand + localStorage for automatic saves
   - SaveData type with version field
   - Migration system for schema evolution

7. **Stat Tier Color System**
   - Centralized STAT_TIER_COLORS in [statConfig.ts](src/engine/statConfig.ts)
   - Referenced across all UI components
   - Single source of truth for theming

### 10.2 Architectural Decisions

1. **Single Tier-Based League (Not Multi-Team Management)**
   - Player controls one team at a time
   - Cannot manage multiple franchises simultaneously
   - Simplifies state management for Phase 1-2
   - Enables future: save multiple careers if desired

2. **Graduated Stamina Penalties (Arcade-Tuned)**
   - Avoids "cliff effect" of binary thresholds
   - Wide "feel good" zone (75-100: no penalty)
   - Smooth degradation encourages strategic rotation
   - 50% exhausted penalty still playable (not forced benching)

3. **Role-Specific Stamina Mechanics**
   - Starters -30/+20 (heavy drain, slow recovery)
   - Batters -10/+38 (light drain, fast recovery)
   - Relievers -18/+26 (medium drain/recovery)
   - Enables different rotation strategies per role

4. **Opponent Strength Scaling (0.9-1.1x)**
   - Ensures ~50% win rate regardless of team power
   - Player team improves → opponents scale up
   - No "easy" phase or "impossible" endgame
   - Dynamic difficulty via stat multipliers

5. **Full Team Objects for Opponents (Not Simplified)**
   - OpponentTeam extends Team with ID, name, personality
   - Enables future: view opponent rosters, trade rumors
   - Consistent data structure across codebase
   - Opens door for league simulation complexity

6. **AI Personality System (Not Deterministic)**
   - 5 preset personalities with continuous values
   - Affects roster rotation decisions contextually
   - Match importance modulates aggressive play
   - Adds variation without full AI decision tree

7. **Zustand for Global State (Not Context)**
   - Single source of truth
   - Automatic localStorage persistence
   - Better performance than React Context
   - Separates concerns (game state vs UI state)

8. **Separation of Settings Store**
   - Independent store from game state
   - User preferences persist across resets
   - Scoped to user, not game instance

9. **Seeded Match Replay**
   - RandomProvider allows deterministic resimulation
   - Same seed = same match outcome
   - Enables debugging, testing, and replay features
   - Foundation for "match highlights" feature

10. **Gradual Performance Curve Over Binary**
    - Rather than "under 50 stamina = -50%", use smooth curve
    - Better game feel, less punishing
    - Encourages threshold management rather than cliff avoidance

### 10.3 Testing Strategy

**13 Test Files Covering:**
- [aiMatchSimulator.test.ts](src/engine/__tests__/aiMatchSimulator.test.ts) - AI match logic
- [aiRotation.test.ts](src/engine/__tests__/aiRotation.test.ts) - Roster rotation decisions
- [atBatSimulator.test.ts](src/engine/__tests__/atBatSimulator.test.ts) - At-bat outcome calculation
- [gameModifiers.test.ts](src/engine/__tests__/gameModifiers.test.ts) - Stamina/fatigue penalties
- [leagueGenerator.test.ts](src/engine/__tests__/leagueGenerator.test.ts) - League creation
- [matchEngine.test.ts](src/engine/__tests__/matchEngine.test.ts) - Full game simulation
- [outcomeConfig.test.ts](src/engine/__tests__/outcomeConfig.test.ts) - Base advancement rules
- [playerGenerator.test.ts](src/engine/__tests__/playerGenerator.test.ts) - Player stat generation
- [randomProvider.test.ts](src/engine/__tests__/randomProvider.test.ts) - RNG implementations
- [recovery.test.ts](src/engine/__tests__/recovery.test.ts) - Stamina recovery mechanics
- [GameController.test.ts](src/services/__tests__/GameController.test.ts) - Service orchestration
- [LeagueController.test.ts](src/services/__tests__/LeagueController.test.ts) - Season progression
- [autoRotatePitchers.test.ts](src/store/__tests__/autoRotatePitchers.test.ts) - Pitcher rotation

**Testing Approach:**
- Unit tests for isolated concerns
- Integration tests for workflows
- Deterministic tests using SeededRandomProvider
- Snapshot tests for complex structures (league schedules)

### 10.4 Code Organization Principles

1. **Single Responsibility:** Each file has one clear purpose
2. **Dependency Injection:** Services injected where needed, no global except gameEvents
3. **Type Safety:** Full TypeScript with discriminated unions and type guards
4. **Configurability:** Constants in one place, not scattered
5. **No Magic Numbers:** All thresholds and multipliers in GAME_CONSTANTS
6. **Explicit Over Implicit:** Variable names are descriptive, logic is clear

### 10.5 Performance Optimizations

1. **Lazy Evaluation:** Stamina multipliers calculated on-demand, not cached
2. **Memoization:** React components use callbacks to prevent unnecessary re-renders
3. **Zustand Selector:** Stores expose selectors to avoid full tree updates
4. **Debounced Save:** localStorage writes debounced (500ms future implementation)
5. **Stepped Simulation:** Foundation for play-by-play animation without blocking

---

## Summary

**Dugout Dynasty** is a well-architected baseball management RPG with:

- **Sophisticated game engine** supporting full 9-inning baseball with detailed player stats and role-specific mechanics
- **Multi-tier league system** providing long-term progression across 5 difficulty tiers
- **Stamina-based strategy** forcing players to manage rotations rather than playing stars every game
- **Scalable opponent system** that adapts to player team strength for balanced matchups
- **Clean service architecture** separating business logic from state management
- **Extensible design** (modifier system, event emitter, outcome configuration) enabling new features
- **Persistent save system** with migrations supporting long-term campaigns
- **Responsive UI** with dark mode, color-coded stats, and intuitive roster management
- **Comprehensive testing** covering simulation logic, rotations, and game mechanics

The codebase emphasizes **readability, maintainability, and game balance** over premature optimization, making it ideal for continued development and iteration.
