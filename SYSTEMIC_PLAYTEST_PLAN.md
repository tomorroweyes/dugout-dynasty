# Dugout Dynasty — Systemic Playtest Plan (Next 3 Experiments)

## Goal
Increase passive watchability (Ant Farm Effect) and reduce menu friction without flattening strategic depth.

## Sprint Scope
- Duration: 1 sprint (7–10 days)
- Method: sequential experiments (A/B where possible)
- Success threshold: at least 2 of 3 experiments hit their primary KPI

---

## Experiment 1 — Inning Forecast Panel (Decision Clarity)

### Problem
Interactive at-bats ask players to juggle approach, adaptation, fatigue, and spirit effects mentally. This can feel like cognitive overhead instead of flow.

### Hypothesis
If players see a compact pre-at-bat forecast, they will make faster, more varied choices and feel more in control.

### Feature
Add a small “Forecast” block above action buttons with:
- Risk tag: Low / Medium / High
- Expected outcome tilt: K-risk, BB chance, XBH pressure
- Adaptation warning: “Repeat penalty active (65%)”
- Fatigue impact preview: “Patient adds +0.15 fatigue” / “Paint costs +0.2 fatigue”

### Minimal Implementation
- Read existing values from approach/strategy config and adaptation state
- No new simulation math; presentation only
- Show for currently highlighted approach/strategy and selected ability

### Primary KPI
- Median time from at-bat start to input decreases by 15%

### Secondary KPIs
- Approach/strategy diversity increases (lower repeat streak length)
- Fewer abandoned interactive matches

### Ship / Kill Rule
- Ship if decision time improves and no drop in session length
- Kill/rework if players over-index one “safe” option after panel launch

---

## Experiment 2 — Broadcast Mode (Ant Farm Watchability)

### Problem
When idle, the game advances but does not consistently feel alive as a spectator sport.

### Hypothesis
If auto-sim feels like a broadcast (pace + momentum + context callouts), players will watch longer and feel attached to unfolding systems.

### Feature
New toggle in interactive match: “Broadcast Mode”
- Auto-sim at cinematic pace (e.g., 350–500ms cadence)
- Commentary overlays:
  - “Pitcher on 3 straight patient AB fatigue pressure”
  - “Adaptation punished repeat power swing”
  - “Momentum swing: +2 team spirit event”
- Quick standings ticker after inning transitions (league context)

### Minimal Implementation
- Reuse existing auto-sim loop
- Add rotating commentary lines from existing state transitions/events
- Add simple pause/resume and speed selector (Slow/Normal/Fast)

### Primary KPI
- Average time spent in auto-sim/watch mode increases by 30%

### Secondary KPIs
- More users complete full interactive matches
- Increased usage of Sim Half / Sim Inning versus Sim to End

### Ship / Kill Rule
- Ship if watch time and full-match completion both rise
- Kill/rework if players skip more often or perceive mode as “slow noise”

---

## Experiment 3 — Post-Match Cause & Effect Cards (Failure as Learning)

### Problem
Losses are mechanically recoverable, but causality is not always explicit enough to feel like a strategic lesson.

### Hypothesis
If post-match surfaces the top 3 decision chains that influenced outcome, losses will feel like pivots instead of punishment.

### Feature
After each match, show 3 cards:
- Trigger: player/system decision
- Ripple: immediate stat/context shift
- Outcome: inning-level consequence

Example:
- Trigger: Repeated Power approach in 6th
- Ripple: Adaptation reduced modifier value to 40%
- Outcome: 2 high-leverage outs, run expectancy drop

### Minimal Implementation
- Derive from existing play-by-play + approach/strategy + adaptation state
- Rank candidate events by impact heuristic (RBI swing, run prevention/loss, leverage inning)
- Keep explanations concise (1–2 lines per card)

### Primary KPI
- Match replay/continue rate increases after losses by 20%

### Secondary KPIs
- More lineup/equipment/approach changes before next match
- Reduced “frustration quit” within 2 minutes post-loss

### Ship / Kill Rule
- Ship if post-loss continuation improves with neutral retention
- Kill/rework if cards are ignored (<20% expand/open rate)

---

## Instrumentation Checklist
Track per match/session:
- atBatDecisionMs (time to choose action)
- approachRepeatStreak and strategyRepeatStreak
- adaptationPenaltyExposure count
- autoSimMode usage by mode and duration
- broadcastMode enabled duration
- postLossContinue boolean
- postMatchCardsViewed and cardExpandRate

---

## Rollout Order (Recommended)
1. Experiment 1 first (lowest risk, immediate clarity gains)
2. Experiment 2 second (largest Ant Farm upside)
3. Experiment 3 third (converts failure into retention)

Reason: clarity improvements make both broadcast comprehension and post-match learning more effective.

---

## One-Sprint Acceptance Criteria
- At least 2 primary KPIs hit target
- No statistically meaningful drop in average session duration
- No rise in “menu fatigue” feedback from playtest notes

If criteria are met, promote all successful experiments to default-on with settings toggles for advanced users.

---

## Build Plan — Experiment 1 (Inning Forecast Panel)

### Objective
Ship a UI-only forecast layer that improves decision speed and confidence at each at-bat without changing simulation outcomes.

### Phase Breakdown

#### Phase A: Data Shaping (Engine-adjacent, no math changes)
1. Create a forecast helper module:
  - `src/engine/forecastPanel.ts` (new)
2. Build pure helpers that map existing match context to display labels:
  - `getRiskTag(...) => "Low" | "Medium" | "High"`
  - `getOutcomeTilt(...) => { kRisk: string; bbPressure: string; xbhPressure: string }`
  - `getAdaptationWarning(...) => string | null`
  - `getFatiguePreview(...) => string | null`
3. Inputs should come from existing state only:
  - selected approach/strategy
  - `consecutiveBatterApproach` / `consecutivePitchStrategy`
  - adaptation scale from constants
  - patient/paint fatigue constants

#### Phase B: UI Integration (Interactive Match)
1. Add component:
  - `src/components/ForecastPanel.tsx` (new)
2. Integrate into:
  - `src/components/InteractiveMatchView.tsx`
3. Placement:
  - Above action buttons in the at-bat control area
4. States:
  - Hidden during auto-sim
  - Hidden on inning/result interstitial screens
  - Visible only when player input is required

#### Phase C: Instrumentation
1. Add capture points:
  - `atBatDecisionStartMs` (set when new at-bat begins)
  - `atBatDecisionMs` (record at action submit)
2. Track repeated-choice patterns:
  - `approachRepeatStreak`
  - `strategyRepeatStreak`
  - `adaptationPenaltyExposure`
3. Persist metrics in lightweight session store or telemetry hook (depending on current analytics setup).

#### Phase D: QA / Validation
1. Confirm outcomes unchanged when forecast is enabled vs disabled (same seed).
2. Verify panel correctness for:
  - power/contact/patient
  - challenge/finesse/paint
  - repeated use adaptation levels
3. Manual UX test:
  - keyboard shortcuts still function
  - no visual overlap on narrow widths

### Suggested File-Level Task List
- New: `src/engine/forecastPanel.ts`
- New: `src/components/ForecastPanel.tsx`
- Update: `src/components/InteractiveMatchView.tsx`
- Optional metrics sink: `src/store/settingsStore.ts` or a new lightweight `src/store/telemetryStore.ts`

### Definition of Done (Exp 1)
- Forecast panel visible and accurate for all player decision contexts
- No gameplay logic diffs in deterministic seeded matches
- Median `atBatDecisionMs` improved by target threshold in playtest sample

---

## Build Plan — Experiment 3 (Post-Match Cause & Effect Cards)

### Objective
Turn match outcomes (especially losses) into actionable learning by showing the top 3 causal chains from decision to consequence.

### Phase Breakdown

#### Phase A: Causal Extraction Engine
1. Create analyzer module:
  - `src/engine/postMatchInsights.ts` (new)
2. Define types:
  - `InsightCard { trigger, ripple, outcome, impactScore, inning, isTop }`
3. Parse existing data:
  - `playByPlay` events
  - approach/strategy tags
  - ability usage flags
  - inning/outs/RBI context
4. Heuristic scoring model (simple + deterministic):
  - run swing events weighted highest
  - high-leverage innings weighted (late innings, close score)
  - repeated adaptation penalties weighted
5. Return top 3 cards sorted by `impactScore`.

#### Phase B: UI Surface
1. Add presentation component:
  - `src/components/PostMatchInsightCards.tsx` (new)
2. Integrate in post-match flows:
  - interactive completion view in `src/components/InteractiveMatchView.tsx`
  - historical match details in `src/components/MatchLog.tsx` (optional phase 2)
3. Show cards prominently for losses; collapsible for wins.

#### Phase C: Event Quality Controls
1. Add guardrails to avoid noisy cards:
  - minimum impact threshold
  - deduplicate similar triggers
  - max 1 card per identical trigger type
2. Fallback behavior:
  - if fewer than 3 high-confidence cards, show 1–2 plus “Key turning point unavailable” placeholder.

#### Phase D: Instrumentation
1. Add interaction metrics:
  - `postMatchCardsViewed`
  - `cardExpandRate`
  - `postLossContinue`
2. Add behavior proxies after view:
  - lineup changes before next match
  - equipment changes before next match

#### Phase E: QA / Validation
1. Snapshot-style tests for deterministic insight generation from fixed play-by-play fixtures.
2. Manual checks:
  - loss with close score
  - blowout loss
  - extra-inning win/loss
  - low-event game with sparse notable moments

### Suggested File-Level Task List
- New: `src/engine/postMatchInsights.ts`
- New: `src/components/PostMatchInsightCards.tsx`
- Update: `src/components/InteractiveMatchView.tsx`
- Update (optional): `src/components/MatchLog.tsx`
- Optional tests: `src/engine/__tests__/postMatchInsights.test.ts`

### Definition of Done (Exp 3)
- Top 3 insight cards generated for most matches with clear causal wording
- Cards render in post-match flow without adding friction to continue
- Post-loss continue rate improves vs baseline in playtest sample

---

## Sequencing for This Request (1 + 3 only)
1. Implement Experiment 1 end-to-end first (lower dependency risk).
2. Reuse instrumentation scaffolding for Experiment 3.
3. Implement Experiment 3 extraction engine before UI component.
4. Run a 3-day focused playtest:
  - Day 1 baseline capture
  - Day 2 with Exp 1 only
  - Day 3 with Exp 1 + Exp 3

This sequencing isolates effects and avoids confounding KPI interpretation.

---

## Implementation Task Board (Ready to Build)

Use this as the sprint execution checklist. Each task is intentionally scoped to a small, reviewable PR.

### Legend
- Priority: `P0` (must for experiment), `P1` (strongly recommended), `P2` (nice-to-have)
- Estimate: dev effort in ideal focused hours
- Dependency: task IDs that should land first

---

## Experiment 1 — Task List (Inning Forecast Panel)

### E1-T01 — Add Forecast Domain Types
- Priority: `P0`
- Estimate: `1h`
- Dependency: none
- Files:
  - `src/engine/forecastPanel.ts` (new)
- Deliverables:
  - `ForecastRiskTag` type (`Low | Medium | High`)
  - `ForecastOutcomeTilt` type (`kRisk`, `bbPressure`, `xbhPressure`)
  - `ForecastSnapshot` interface for panel data contract
- Acceptance:
  - Type signatures compile and are imported cleanly from UI layer

### E1-T02 — Build Pure Forecast Selectors
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E1-T01`
- Files:
  - `src/engine/forecastPanel.ts`
- Deliverables:
  - `getRiskTag(...)`
  - `getOutcomeTilt(...)`
  - `getAdaptationWarning(...)`
  - `getFatiguePreview(...)`
  - `buildForecastSnapshot(...)`
- Rules:
  - Use only existing state/config values
  - Do not alter simulation output paths
- Acceptance:
  - Functions are deterministic and side-effect free

### E1-T03 — Unit Tests for Forecast Mapping
- Priority: `P1`
- Estimate: `2h`
- Dependency: `E1-T02`
- Files:
  - `src/engine/__tests__/forecastPanel.test.ts` (new)
- Deliverables:
  - Cases for all approaches (`power`, `contact`, `patient`)
  - Cases for all strategies (`challenge`, `finesse`, `paint`)
  - Adaptation warning at repeated-use tiers
- Acceptance:
  - Tests pass and cover all risk labels + fatigue preview branches

### E1-T04 — Build Forecast Panel Component
- Priority: `P0`
- Estimate: `2h`
- Dependency: `E1-T02`
- Files:
  - `src/components/ForecastPanel.tsx` (new)
- Deliverables:
  - Compact UI block for Risk, Tilt, Adaptation, Fatigue
  - Handles null/missing data gracefully
- Acceptance:
  - Component renders correctly in dark/light and 8-bit theme styles

### E1-T05 — Wire Forecast into Interactive Match View
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E1-T04`
- Files:
  - `src/components/InteractiveMatchView.tsx`
- Deliverables:
  - Forecast visible only when player is actively deciding
  - Hidden during auto-sim and transition overlays
  - Forecast updates with selected approach/strategy/ability context
- Acceptance:
  - Keyboard shortcut flows remain unchanged
  - No layout overlap at common responsive breakpoints

### E1-T06 — Decision-Time Instrumentation Hooks
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E1-T05`
- Files:
  - `src/components/InteractiveMatchView.tsx`
  - `src/store/telemetryStore.ts` (new, recommended) OR existing settings/analytics hook
- Deliverables:
  - Start timestamp at at-bat decision open
  - End timestamp on action submit
  - Log `atBatDecisionMs`, repeat streaks, adaptation exposure
- Acceptance:
  - Metrics events emitted once per at-bat decision

### E1-T07 — Determinism Safety Check
- Priority: `P0`
- Estimate: `1.5h`
- Dependency: `E1-T05`
- Files:
  - `src/engine/__tests__/interactiveMatchEngine.test.ts` (or nearest match determinism suite)
- Deliverables:
  - Before/after snapshot using same seed confirms no outcome drift from forecast feature
- Acceptance:
  - Same seed => identical at-bat outcomes with forecast code present

### E1-T08 — QA Pass + Playtest Script
- Priority: `P1`
- Estimate: `1h`
- Dependency: `E1-T06`, `E1-T07`
- Deliverables:
  - Manual QA checklist run completed
  - Quick 10-match pilot with decision-time metric export
- Acceptance:
  - No regressions in match controls and action input latency

---

## Experiment 3 — Task List (Post-Match Cause & Effect Cards)

### E3-T01 — Define Insight Data Model
- Priority: `P0`
- Estimate: `1h`
- Dependency: none
- Files:
  - `src/engine/postMatchInsights.ts` (new)
- Deliverables:
  - `InsightCard` type
  - `InsightTriggerType` enum/union
  - `InsightComputationInput` type
- Acceptance:
  - Stable typed contract between engine and UI

### E3-T02 — Build Candidate Event Extractor
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E3-T01`
- Files:
  - `src/engine/postMatchInsights.ts`
- Deliverables:
  - Parse play-by-play into candidate causal events
  - Include trigger metadata (approach/strategy repetition, ability usage, RBI swings)
- Acceptance:
  - Produces candidate list for matches with non-empty play-by-play

### E3-T03 — Implement Impact Scoring Heuristic
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E3-T02`
- Files:
  - `src/engine/postMatchInsights.ts`
- Deliverables:
  - Deterministic impact scoring with weights for:
    - run swing
    - leverage inning (late + close)
    - adaptation penalty exposure
  - Sort + top-3 selector
- Acceptance:
  - Top cards are stable for identical inputs

### E3-T04 — Deduplication + Noise Guardrails
- Priority: `P1`
- Estimate: `2h`
- Dependency: `E3-T03`
- Files:
  - `src/engine/postMatchInsights.ts`
- Deliverables:
  - Min-impact threshold
  - No duplicate trigger spam
  - Fallback messaging when <3 high-confidence cards
- Acceptance:
  - Returned card list is concise and non-repetitive

### E3-T05 — Unit Tests for Insight Engine
- Priority: `P1`
- Estimate: `2.5h`
- Dependency: `E3-T04`
- Files:
  - `src/engine/__tests__/postMatchInsights.test.ts` (new)
- Deliverables:
  - Fixtures: close loss, blowout loss, extra innings, low-event game
  - Assertions on ranking order and fallback behavior
- Acceptance:
  - Deterministic pass across all fixtures

### E3-T06 — Build Insight Cards UI Component
- Priority: `P0`
- Estimate: `2h`
- Dependency: `E3-T03`
- Files:
  - `src/components/PostMatchInsightCards.tsx` (new)
- Deliverables:
  - Render 1–3 cards: Trigger, Ripple, Outcome
  - Collapsible section support
- Acceptance:
  - Readable at desktop and smaller widths

### E3-T07 — Integrate in Interactive Match End Flow
- Priority: `P0`
- Estimate: `3h`
- Dependency: `E3-T06`
- Files:
  - `src/components/InteractiveMatchView.tsx`
- Deliverables:
  - Show insights on final screen
  - Emphasize for losses, collapsed by default for wins
- Acceptance:
  - Continue button remains obvious and unblocked

### E3-T08 — Optional Match Log Integration
- Priority: `P2`
- Estimate: `1.5h`
- Dependency: `E3-T06`
- Files:
  - `src/components/MatchLog.tsx`
- Deliverables:
  - Add insights to expanded match details view
- Acceptance:
  - Older matches with missing data fail gracefully

### E3-T09 — Insight Interaction Instrumentation
- Priority: `P0`
- Estimate: `2h`
- Dependency: `E3-T07`
- Files:
  - `src/components/PostMatchInsightCards.tsx`
  - telemetry store/hook
- Deliverables:
  - Emit `postMatchCardsViewed`, `cardExpandRate`, `postLossContinue`
- Acceptance:
  - Metrics emitted once per relevant user interaction

### E3-T10 — QA + Outcome Review Script
- Priority: `P1`
- Estimate: `1h`
- Dependency: `E3-T09`
- Deliverables:
  - Manual verification for 4 scenario types
  - 10-match sample review for card quality
- Acceptance:
  - No blocking UI regressions in post-match flow

---

## Suggested PR Breakdown

### PR-1 (Experiment 1 Core)
- `E1-T01` to `E1-T05`

### PR-2 (Experiment 1 Metrics + Safety)
- `E1-T06` to `E1-T08`

### PR-3 (Experiment 3 Engine)
- `E3-T01` to `E3-T05`

### PR-4 (Experiment 3 UI + Metrics)
- `E3-T06`, `E3-T07`, `E3-T09`, `E3-T10`

### PR-5 (Optional Historical Insights)
- `E3-T08`

---

## Execution Order (Fastest Path to Value)
1. Complete `PR-1` and deploy to internal playtest.
2. Collect one-day baseline for Exp 1 KPIs.
3. Complete `PR-3` while Exp 1 baseline runs.
4. Complete `PR-4`, then run combined Exp 1 + Exp 3 pilot.
5. Decide on `PR-5` based on early card engagement metrics.

---

## Ready-to-Start Today (First 4 Tasks)
- `E1-T01` Add forecast types
- `E1-T02` Implement forecast selectors
- `E1-T04` Build panel component
- `E1-T05` Integrate panel into interactive match view

These four tasks deliver immediate visible progress with minimal regression risk.
