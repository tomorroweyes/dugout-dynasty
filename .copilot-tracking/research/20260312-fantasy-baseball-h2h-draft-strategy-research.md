<!-- markdownlint-disable-file -->

# Task Research Notes: Fantasy Baseball H2H Draft Strategy

## Research Executed

### File Analysis

- /Users/cam/dev/dustycleats/package.json
  - Main app is a Vite/TypeScript workspace; no repo-local fantasy strategy instruction file exists, so research needed to be self-contained and externally validated.
- /Users/cam/dev/dustycleats/.github/workflows/deploy.yml
  - Repo uses docs/build workflows only; no local drafting-strategy conventions or heuristics files were present.
- /Users/cam/dev/dustycleats/.github/workflows/fantasy-refresh.yml
  - Fantasy tool data refresh is automated, which suggests a future draft tool should prefer stable, rule-based heuristics over one-off manual notes.

### Code Search Results

- `.github/instructions/**`
  - No files found.
- `copilot/**`
  - No files found.
- `.copilot-tracking/research/**`
  - No files found before this research note was created.
- `.github/**`
  - Found only workflow files; no repo-specific research or drafting instructions.

### External Research

- #fetch:https://fantraxhq.com/fantasy-baseball-draft-tips/
  - Stable guidance: play it safe in the first 5-6 rounds, build a balanced roster, wait on middle infield, avoid paying early for closers, and use reserve-round middle relievers for ratio insulation.
- #fetch:https://fantraxhq.com/10-ways-to-sabotage-your-fantasy-baseball-draft/
  - Common failure modes: not knowing league settings, punting categories, ignoring playing time, refusing to adapt to the room, overloading on injuries/prospects, and team stacking.
- #fetch:https://pitcherlist.com/ultimate-fantasy-baseball-draft-guide-for-2025-who-to-draft-when/
  - Core macro philosophy: do not draft as if it is best ball; plan to churn the back of the roster, keep category targets in view, take hitters early, and only draft late players you can evaluate or cut quickly.
- #fetch:https://pitcherlist.com/top-400-starting-pitchers-for-fantasy-baseball-2026/
  - Pitching construction principle: secure four trustworthy SPs, then use easy-drop upside arms and the waiver wire; weekly matchup scheduling matters and shallow-league managers should exploit streaming.
- #fetch:https://fantraxhq.com/2026-fantasy-baseball-quality-starts-primer/
  - QS leagues reward durability, team usage patterns, and pitchers allowed to work deep into games; injury-limited arms and debut-year pitching prospects lose value.
- #fetch:https://fantraxhq.com/when-draft-closer-fantasy-baseball/
  - In 10/12-team formats, elite closers can be justified around rounds 4-5 at the earliest, but later values frequently emerge and saves remain volatile.
- #fetch:https://fantraxhq.com/2024-fantasy-baseball-draft-strategy-for-saves-holds-leagues/
  - In SV+H formats, closer scarcity flattens, non-closing high-leverage relievers gain value, and the best targets are good relievers on strong teams or next-man-up bullpen options.
- #fetch:https://fantasy.fangraphs.com/catcher-2026-fantasy-rankings/
  - In shallow one-catcher leagues, waiting is usually correct; catcher scarcity becomes meaningfully actionable only in deeper or two-catcher formats.
- #fetch:https://fantraxhq.com/updated-obp-league-player-rankings-for-2025-fantasy-baseball/
  - Plate-discipline formats increase separation between patient power bats and empty-average hitters; average pitchers move up because low-OBP bats become liabilities. This partially carries over to OPS leagues.

### Project Conventions

- Standards referenced: repo has no fantasy-strategy instruction files; only workflow/config files were present, so research output is documentation-first and league-settings-aware.
- Instructions followed: research-only workflow, no source-code edits outside `./.copilot-tracking/research/`, only verified findings from workspace inspection and external sources.

## Key Discoveries

### Project Structure

This workspace contains a main game app and a separate fantasy-draft-tool, but there was no existing strategy research or heuristic specification for fantasy baseball draft construction. That means the most useful output is a compact set of league-context-aware draft heuristics that a tool can later encode as rules, boosts, penalties, and warnings.

### Implementation Patterns

The strongest cross-source pattern is not “rank the best players”; it is “build a roster shape that can win categories while leaving churnable slots for in-season management.” Across sources, the recurring ideas were:

1. Take safe, bankable category anchors early, especially hitters.
2. Avoid paying scarcity premiums where shallow-league replacement value is high.
3. Distinguish foundation picks from churn picks, especially among pitchers.
4. Treat bullpen strategy as format-dependent: saves-only and SV+H are materially different games.
5. Keep draft rules subordinate to league context: team count, lineup depth, weekly vs daily moves, innings/start caps, RP slots, and platform eligibility rules all change optimal construction.

### Complete Examples

```text
Example draft-tool heuristics for a shallow H2H categories league:

- Early-round hitter boost:
  Boost hitters who project to contribute in at least 4 of 5 hitting categories.
  Extra boost if they contribute both power and speed without AVG/OBP/OPS downside.

- Shallow-league scarcity penalty:
  In 8-team, 1-catcher formats, suppress catcher scarcity premium until elite option falls at least 1-2 rounds past market.
  Apply similar suppression to 2B/SS scarcity unless the player is also a category anchor.

- SP foundation rule:
  By the end of the mid rounds, aim to roster 2 reliable SP anchors and 4 total SP you are comfortable holding.
  Mark later SP picks as “easy-drop” upside bets, not fixed-season assets.

- Bullpen format split:
  Saves-only: closers receive role premium.
  SV+H: reduce closer premium, boost high-K setup men on strong teams, and boost next-man-up relievers.

- Weekly matchup mode:
  If already favored in ratios and SV+H, prefer reliever-heavy active lineups.
  If trailing in K/QS by midweek, pivot flexible P slots toward start volume.
```

### API and Schema Documentation

For a draft tool to apply these findings correctly, it needs the following league-context inputs:

- League size
- Snake or auction draft
- Pick slot
- Hitting categories
- Pitching categories
- Number of active hitter slots
- Number of active pitcher slots
- Number of mandatory RP slots
- Bench size
- Weekly vs daily lineup locks
- Weekly transaction limit
- Innings cap or starts cap
- Platform eligibility rules
- One-catcher vs two-catcher

Minimum derived outputs the tool should calculate:

- Replacement-level baseline by position
- Category surplus/deficit tracker after each pick
- Foundation vs churn label for every roster spot
- Format-specific bullpen valuation mode: saves-only vs SV+H
- QS-specific workload boost for starters
- Shallow-league scarcity suppression for catcher and middle infield

### Configuration Examples

```yaml
recommended_profile:
  league_context:
    shallow_8_team: true
    weekly_h2h_categories: true
    one_catcher: true
    active_hitters: 9
    active_pitchers: 9
    rp_slots: 3
    draft_slot: 5
  priorities:
    early_rounds:
      safe_five_category_hitters: high
      catcher_priority: low
      closer_priority: low
      middle_infield_scarcity: low
    mid_rounds:
      second_sp_anchor: medium_high
      category_balance: high
      playing_time_security: high
    late_rounds:
      easy_drop_sp_upside: high
      high_leverage_rp: high
      prospect_stashes: low_medium
  format_adjustments:
    qs:
      workload_and_team_usage: boost
      injury_limited_arms: penalty
    sv_plus_h:
      non_closing_high_leverage_rp: boost
      elite_closer_premium: reduce
    ops_if_counted:
      walks_and_slg: boost
      empty_batting_average_profiles: penalty
```

### Technical Requirements

The most important technical requirement is league-context branching. Advice that is valid in a 12-team standard 5x5 league is not automatically valid in an 8-team shallow league with 3 RP slots, QS, and SV+H. The tool should explicitly translate the research as follows:

- Shallow leagues increase replacement value, so star quality beats positional scarcity.
- One-catcher leagues reduce catcher urgency sharply.
- QS leagues reward innings and team leash more than pure strikeout flash.
- SV+H leagues flatten closer pricing and make ratio relievers more useful.
- Weekly H2H makes matchup logic and roster flexibility more important than season-long aggregate value.

## Recommended Approach

Selected approach: build around elite, low-friction hitters early; leave the draft with two reliable SP anchors and enough RP quality to control weekly ratio/SV+H outcomes; treat catcher, middle infield scarcity, and closers as market traps in shallow formats unless the room gifts value.

This was chosen over a pure “two aces immediately” start or an aggressive “lock the top closers” start because the cross-source evidence consistently favored safe early bats, flexible back-half churn, shallow-league replacement awareness, and bullpen volatility management. In the user’s likely context of an 8-team snake draft from pick 5 with 9 hitter starters, 9 pitcher starters, and 3 RP slots, that points to a star-hunting, category-balanced, shallow-league build rather than scarcity chasing.

1. Early-round principles
   Prioritize hitters who contribute across categories and do not force later repairs. The best recurring heuristic is “everyone chips in power and steals” rather than taking one-category sluggers or speed specialists too early. Early rounds should be low-friction: stable playing time, clean health profile, strong lineup spot, and broad category impact. In a shallow 8-team league from pick 5, the optimal opening is usually elite bat first, elite bat second if value holds, then pivot toward SP anchor only when hitter drop-off becomes sharper than pitcher drop-off.

2. Mid-round roster construction
   Use the mid rounds to finish your category skeleton rather than chase names. By this point, the roster should have enough early power/speed that you can draft for fit: batting-order stability, multi-position flexibility, second SP anchor, and whatever hitting category is lagging. The tool should flag rosters that are becoming too dependent on one later fix, such as “need 40 steals later” or “need two ratio anchors later.” In shallow leagues, replacement bats exist, so mid-round leverage comes more from role certainty and complementary category shape than from nominal positional scarcity.

3. Late-round exploitation
   Late picks should be churn picks, not comfort picks. Favor players who can materially change value quickly: high-upside SPs you can cut fast, high-leverage relievers who can earn ninth-inning work, and hitters with path-to-playing-time plus one carrying skill. Avoid drafting bland, low-ceiling “floor” starters at the back; the waiver wire can usually supply that. In shallow formats, this is even more important because the wire is stronger and the opportunity cost of dead roster spots is higher.

4. Positional scarcity traps vs real leverage
   The biggest trap is overpaying for catcher or middle infield in shallow leagues just because the position once felt thin. Current consensus is that one-catcher shallow formats are wait-friendly, and middle infield is deeper than older fantasy intuitions suggest. Real leverage comes from elite category separation, not filling a scarce label. Scarcity becomes real only when league depth rises, a second catcher is required, or the position pool clearly falls off beyond replacement. In an 8-team, 1-catcher build, catcher should usually be treated as a discount hunt, not a pillar.

5. Pitching strategy for H2H categories
   In standard H2H categories, the goal is not just total pitcher value; it is weekly controllability. Draft at least two SP anchors you trust, then enough total SP foundation to avoid desperation streaming. For QS leagues, boost pitchers with workload, command, and team leash; penalize injury-returners, capped workloads, and flashy but short-outing arms. For SV+H leagues, reduce the premium on closers and increase the value of high-K setup men on strong teams. With 3 RP slots in a shallow league, a strong RP base can let you win SV+H while protecting ERA/WHIP, then use flexible pitcher slots to chase K/QS only when needed. Weekly logic should be: if ratios are live and SV+H is secure, do not force bad starts; if behind in K/QS by midweek, open the spigots on volume.

6. Category management principles for OPS leagues with H, R, HR, RBI, SB and K, QS, ERA, WHIP, SV+H
   If OPS is truly an additional or substituted hitter category, upgrade patient power bats and downgrade empty-average hitters with weak walk rates or mediocre slug. OBP research translates directionally here: patient sluggers separate more, and low-OBP table setters lose some shine. If the actual league uses Hits instead of OPS, then de-emphasize that adjustment and focus more on plate appearance volume. Either way, do not punt steals or SV+H at the draft table in H2H unless the league is extremely shallow and waivers are unusually rich. H2H category management works best from a balanced baseline where later pickups can push one or two categories, not rescue three. The tool should track whether the roster can plausibly compete in all hitting categories while remaining above water in ERA/WHIP and SV+H.

7. Queue/on-the-clock tactics
   Maintain a queue by tiers, not a rigid rank list. Track the rosters of the two or three drafters nearest your next pick, especially near turns. Queue at least one fallback per build need: one hitter, one SP, one RP, one multi-position bat. The draft room itself can distort value, so pre-tagging targets and sleepers matters. If a position run starts, the tool should only recommend joining it when the drop-off after the run is real; otherwise it should recommend taking the better value and using replacement-level depth later.

8. Common mistakes to warn against
   The highest-confidence warnings are: drafting for name value, drafting to spring headlines, ignoring league settings, overloading injury risk, overloading prospects, punting categories too early, overpaying closers in shallow formats, paying fake scarcity at catcher/MI, and refusing to adapt when the room changes. In this specific shallow format, the most likely mistakes are acting like it is a 12- or 15-team scarcity league, drafting a catcher or closer too early, and filling late rounds with players who are hard to cut.

Context-specific note for 8-team, pick 5, 9H/9P, 3 RP:
The shallowness pushes the recommended build further toward stars-and-flexibility. The tool should prefer elite hitters early, suppress catcher and middle-infield scarcity, wait longer on the first closer unless the format is saves-only, and actively encourage three useful relievers in SV+H because 3 RP slots create weekly ratio leverage. A practical target is two strong bats in the first two rounds, one SP anchor by around rounds 3-5, a second reliable SP soon after, then category-fit hitters and relievers rather than positional panic picks.

## Implementation Guidance

- **Objectives**: Produce draft heuristics that optimize roster construction for shallow H2H category leagues, not just player ranking; keep all logic league-settings-aware.
- **Key Tasks**: Encode early-round hitter safety, shallow-league scarcity suppression, QS-specific SP workload boosts, SV+H bullpen flattening, category-balance tracking, and weekly matchup toggles between ratio protection and volume chasing.
- **Dependencies**: League settings input, platform eligibility rules, projection source, ADP source, role/depth-chart data, and replacement-level calculations by position and roster depth.
- **Success Criteria**: The tool warns against false scarcity, protects against one-category holes, adapts bullpen recommendations to saves-only vs SV+H, values durable QS-friendly starters appropriately, and changes advice when league depth shifts from shallow to standard or deep.
