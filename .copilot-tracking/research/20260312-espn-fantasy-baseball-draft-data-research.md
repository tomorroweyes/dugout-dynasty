<!-- markdownlint-disable-file -->

# Task Research Notes: ESPN Fantasy Baseball Draft Data Exposure

## Research Executed

### File Analysis

- /Users/cam/dev/dustycleats/package.json
  - Workspace is a Vite/TypeScript app with no repo-local ESPN integration guidance; research needed to be self-contained and implementation-focused.
- /Users/cam/dev/dustycleats/.copilot-tracking/research/20260312-fantasy-baseball-h2h-draft-strategy-research.md
  - Existing research notes follow the required markdown template, but no prior note covered ESPN API or draft-data retrieval.

### Code Search Results

- `.github/instructions/**`
  - No files found.
- `copilot/**`
  - No files found.
- `.copilot-tracking/research/**`
  - Existing research file found for fantasy draft strategy, but nothing on ESPN API/data exposure.
- `ESPN fantasy baseball page HTML token search`
  - Live `curl` against `https://fantasy.espn.com/baseball/league?leagueId=1` showed mostly app-shell HTML and did not expose straightforward embedded `leagueId`, `seasonId`, or readable `mDraftDetail`/`mSettings` JSON in the raw HTML response.
- `cwendt94/espn-api baseball integration tests`
  - Verified public baseball sample league fixture: `League(81134470, 2021)` in `tests/baseball/integration/test_league.py`.
- `kona_player_info live filter validation`
  - ESPN returned `FILTER_LIMIT_MISSING_SORT` when `limit` was supplied without a sort, confirming that practical player-pool queries need an explicit sort in `x-fantasy-filter`.

### External Research

- #githubRepo:"cwendt94/espn-api baseball espn_requests mDraftDetail kona_player_info"
  - Verified current base host constant is `https://lm-api-reads.fantasy.espn.com/apis/v3/games/`; sport mapping is `mlb -> flb`; league bootstrap uses `mTeam`, `mRoster`, `mMatchup`, `mSettings`, `mStandings`; draft fetch uses `mDraftDetail`; player-pool fetch uses `view=kona_player_info` with `x-fantasy-filter`.
- #githubRepo:"cwendt94/espn-api baseball integration test league 81134470"
  - Verified a working public baseball league fixture (`81134470`, `2021`) used by integration tests, which made direct live endpoint validation possible.
- #githubRepo:"cwendt94/espn-api discussions 551 draft sync 653 BasePick"
  - Maintainer stated in Aug 2024, reaffirmed by later 2025 replies, that ESPN does not expose draft-time APIs for available players/live team assignment during the draft, while post-draft data becomes available. Separate Aug 2025 discussion confirmed `mDraftDetail` lacks position data and requires lookup by `playerId`.
- #fetch:https://stmorse.github.io/journal/espn-fantasy-v3.html
  - Cross-checked that ESPN fantasy uses view-based v3 endpoints, private leagues require `SWID` and `espn_s2` cookies, and browser network inspection is the practical way to discover page-triggered API requests. The page also notes the post-April-2024 base host change to `lm-api-reads.fantasy.espn.com`.
- #fetch:https://stmorse.github.io/journal/espn-fantasy-projections.html
  - Cross-checked the same cookie model and confirmed that roster/player stats and projections are available through view-based requests; this supports the reliability of using league/player API views instead of scraping page HTML.

### Project Conventions

- Standards referenced: no `copilot/` or `.github/instructions/` directories exist in this workspace; repo conventions had to be inferred from the existing research notes and top-level TypeScript workspace configuration.
- Instructions followed: research-only workflow, no source-code/config edits outside `./.copilot-tracking/research/`, and all findings below are based on direct tool output or explicitly cited external sources.

## Key Discoveries

### Project Structure

This repository contains a separate fantasy draft tool, but no existing ESPN integration note or reverse-engineered endpoint documentation. The most useful output for follow-on work is therefore a single source of truth for what ESPN exposes publicly, what shifts behind authentication, and what draft-specific data can realistically be derived versus directly retrieved.

### Implementation Patterns

The strongest pattern is that ESPN fantasy baseball data is exposed through view-based JSON endpoints, not reliably through server-rendered page HTML. In practice:

1. The raw fantasy page HTML is mostly an app shell and is a weak source for league data.
2. The reliable data path is the unofficial v3 JSON API under `lm-api-reads.fantasy.espn.com/apis/v3/games/flb/...`.
3. League structure and completed draft history come from league-scoped views like `mSettings`, `mTeam`, `mRoster`, `mStandings`, and `mDraftDetail`.
4. Player pools and ranking-like views come from `view=kona_player_info` plus an `x-fantasy-filter` header.
5. Private league access is cookie-gated via the user’s own `SWID` and `espn_s2` session cookies.
6. True live-draft state appears to be materially more restricted than post-draft league state.

### Complete Examples

```json
{
  "verified_public_views": {
    "settings": "GET /apis/v3/games/flb/seasons/2021/segments/0/leagues/81134470?view=mSettings",
    "draft": "GET /apis/v3/games/flb/seasons/2021/segments/0/leagues/81134470?view=mDraftDetail",
    "teams_rosters": "GET /apis/v3/games/flb/seasons/2021/segments/0/leagues/81134470?view=mTeam&view=mRoster&view=mStandings"
  },
  "verified_mSettings_fields": {
    "id": 81134470,
    "draftDetail": {
      "drafted": true,
      "inProgress": false
    },
    "settings": {
      "isPublic": true,
      "draftSettings": {
        "orderType": "MANUAL",
        "pickOrder": [1, 3, 5, 2, 8, 6, 4, 7],
        "timePerSelection": 90,
        "type": "SNAKE"
      },
      "rosterSettings": {
        "autoPilotTypeSupported": "NONE"
      },
      "scoringSettings": {
        "playerRankType": "STANDARD"
      }
    }
  },
  "verified_mDraftDetail_fields": {
    "draftDetail": {
      "drafted": true,
      "inProgress": false,
      "picks": [
        {
          "overallPickNumber": 1,
          "roundId": 1,
          "roundPickNumber": 1,
          "teamId": 1,
          "playerId": 33039,
          "lineupSlotId": 5,
          "autoDraftTypeId": 4,
          "keeper": false,
          "bidAmount": 0
        }
      ]
    }
  },
  "verified_kona_player_info_fields": {
    "player": {
      "fullName": "Nick Ramirez",
      "ownership": {
        "averageDraftPosition": 260.0,
        "percentOwned": 0.0,
        "percentStarted": 0.0
      }
    },
    "ratings": {
      "0": {
        "positionalRanking": 331,
        "totalRanking": 1057,
        "totalRating": 19.0
      }
    }
  }
}
```

### API and Schema Documentation

Verified endpoint/view patterns as of Mar 2026:

- Base host: `https://lm-api-reads.fantasy.espn.com/apis/v3/games/`
- Baseball sport path: `flb`
- Current-season/public/private league base form: `/flb/seasons/{year}/segments/0/leagues/{leagueId}`
- Historical fallback form used by clients for older seasons or alternate retries: `/flb/leagueHistory/{leagueId}?seasonId={year}`

Verified league-level views:

- `mSettings`
  - League name, public/private flag, scoring settings, roster settings, draft settings, draft order, and some autopilot-related capability flags.
- `mTeam`
  - Team metadata and owner references.
- `mRoster`
  - Rosters, player entries, lineup slot assignments, and roster state.
- `mStandings`
  - Team standings and ranking context.
- `mMatchup`, `mMatchupScore`, `mScoreboard`
  - Matchups and scored schedule views.
- `mDraftDetail`
  - Completed or in-progress draft summary object with `drafted`, `inProgress`, and `picks`.

Verified player-pool view:

- `kona_player_info`
  - Player pool search/listing endpoint used with `x-fantasy-filter`.
  - Supports sort/filter patterns including `sortDraftRanks`, `filterStatus`, and ID-based filters.
  - Live payload includes ownership fields such as `averageDraftPosition`, plus `ratings` structures with `positionalRanking`, `totalRanking`, and `totalRating`.

Observed schema limits:

- `mDraftDetail` does not include player position directly.
- `mDraftDetail` does include `autoDraftTypeId` on completed picks, but that is evidence about how a pick was executed, not a published future pick queue.
- `kona_player_info` queries with `limit` require a sort, or ESPN returns `FILTER_LIMIT_MISSING_SORT`.

### Configuration Examples

```yaml
espn_fantasy_baseball_data_model:
  public_data:
    league_settings:
      source: mSettings
      includes:
        - league name
        - public/private flag
        - roster settings
        - scoring settings
        - draft settings
        - draft pick order
    completed_draft:
      source: mDraftDetail
      includes:
        - drafted flag
        - inProgress flag
        - picks
        - playerId
        - teamId
        - roundId
        - roundPickNumber
        - overallPickNumber
        - autoDraftTypeId
    player_pool_rankings:
      source: kona_player_info + x-fantasy-filter
      includes:
        - ownership.averageDraftPosition
        - ratings.totalRanking
        - ratings.positionalRanking
        - ratings.totalRating
  authenticated_data:
    private_league_views:
      auth: SWID + espn_s2 cookies
      likely_same_views_as_public: true
    user_specific_pre_draft_state:
      auth: required
      directly_verified: false
      examples:
        - custom queue
        - per-user pre-draft ranks
        - draft-room live state
```

### Technical Requirements

1. What is likely available publicly vs authenticated

Publicly retrievable when the league itself is public:

- League settings via `mSettings`
- Team/roster/standings data via `mTeam`, `mRoster`, `mStandings`
- Completed draft history via `mDraftDetail`
- General player-pool ranking data via `kona_player_info`, including ownership/ADP/rating fields

Authenticated with the user’s own cookies for private leagues:

- The same core league views for a private league, using `SWID` and `espn_s2`
- Any private-league-only team/roster/draft/settings data not readable anonymously

Not directly verified in this research and likely user-session-specific even when logged in:

- Per-user custom queue
- Per-user custom pre-draft ranks
- Real-time draft-room available-player state during an active draft
- A future auto-pick target list

2. Likely endpoints or page-embedded JSON patterns

Most likely practical endpoints:

- `/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{leagueId}?view=mSettings`
- `/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{leagueId}?view=mDraftDetail`
- `/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{leagueId}?view=mTeam&view=mRoster&view=mStandings`
- `/apis/v3/games/flb/seasons/{year}/segments/0/leagues/{leagueId}?view=kona_player_info&scoringPeriodId={n}` with `x-fantasy-filter`

Most likely page-embedded pattern conclusion:

- Raw HTML is not the reliable source. ESPN appears to serve a JS-heavy shell, and the useful JSON is fetched by XHR/API requests after page load. The browser Network tab is therefore more useful than `view-source` or raw HTML scraping.

3. Whether true auto-pick order is directly exposed or only approximable

Best-supported conclusion: true future auto-pick order is not directly exposed in the known public/unofficial endpoints.

What is directly exposed:

- League draft structure and base pick order in `settings.draftSettings.pickOrder`
- Completed picks in `draftDetail.picks`
- A per-pick `autoDraftTypeId` field after a pick has been made
- ESPN/global ranking-like data through `kona_player_info`

What is not directly verified as exposed:

- The live future player that ESPN will auto-pick next for a specific team
- A user’s exact queue ordering
- A user’s exact custom pre-draft ranking sheet

Therefore, future auto-pick order is only approximable from:

- ESPN rank/order signals from `kona_player_info`
- league rules and roster constraints from `mSettings`
- already drafted players from `mDraftDetail`
- optionally, user-maintained queue data captured locally from the user’s own browser/session if they choose to inspect draft-room requests manually

4. Practical implementation guidance for a local script

Recommended local retrieval strategy:

- Prefer direct JSON requests to `lm-api-reads.fantasy.espn.com`, not HTML scraping.
- Read `SWID` and `espn_s2` from the user’s browser session on their own machine and keep them local only.
- First fetch `mSettings` to identify draft type, pick order, roster constraints, scoring type, and whether the league is public/private.
- Fetch `mDraftDetail` to get completed picks and detect whether the draft has started or finished.
- Fetch `kona_player_info` with `x-fantasy-filter` to pull player pools sorted by draft ranks and filtered by status or position.
- Join `mDraftDetail.playerId` values against player-pool data if positional context or richer player metadata is needed.
- Treat custom queue/pre-draft ranks as optional browser-observed session state, not guaranteed stable API state.

Practical filter guidance verified from live behavior:

- Include a sort whenever using `limit` with `kona_player_info`.
- `sortDraftRanks` is a viable sort key for draft-rank style player-pool pulls.
- `filterStatus` can be used to target free agents/waivers.

5. Legal and technical cautions

- This is an undocumented API, so schemas and hosts can change without notice. The base host already changed in 2024.
- Session cookies are effectively credentials. They should stay on the user’s own machine, never be logged, committed, or sent to third-party services.
- ESPN page HTML is brittle and not a good long-term contract; relying on XHR endpoints is less brittle, but still unofficial.
- Member IDs, owner references, and roster data can contain personal or semi-identifying information; local storage should be handled accordingly.
- Rate limiting and anti-abuse protections are undocumented, so request volume should stay conservative.
- Because the API is unofficial, there is no support guarantee and no stable public contract for live draft-room internals.

## Recommended Approach

Use a local, cookie-authenticated JSON client against ESPN’s unofficial v3 endpoints, anchored on `mSettings`, `mDraftDetail`, and `kona_player_info`, and explicitly treat live draft auto-pick behavior as an approximation problem rather than a directly supported API feature.

This approach was selected over HTML scraping or draft-room-only reverse engineering because it is the most evidence-backed and least brittle path. It is supported by all of the following verified findings:

- The maintained unofficial client uses `lm-api-reads.fantasy.espn.com/apis/v3/games/flb/...` and not raw HTML parsing.
- Live requests against a verified public baseball league returned `mSettings`, `mDraftDetail`, and `kona_player_info` payloads successfully.
- The page HTML itself did not yield clean embedded league JSON in a simple raw fetch.
- Maintainer guidance in 2024-2025 indicates that live draft availability/player state is not exposed cleanly during the draft.

Net result:

- Public or authenticated league metadata is retrievable.
- Post-draft pick history is retrievable.
- ESPN ranking signals are retrievable.
- Future auto-pick order is not directly exposed and should be modeled as inferred output, not trusted ground truth.

## Implementation Guidance

- **Objectives**: Retrieve reliable ESPN fantasy baseball league settings, draft results, and ranking signals on the user’s own machine while avoiding brittle HTML scraping and avoiding unsupported assumptions about live auto-pick internals.
- **Key Tasks**: Identify the target league/year; obtain the user’s local `SWID` and `espn_s2` for private leagues; fetch `mSettings`; fetch `mDraftDetail`; query `kona_player_info` with explicit `x-fantasy-filter` sorts; join draft picks to player metadata when position/rank context is needed; model future auto-pick behavior as inferred rather than exposed.
- **Dependencies**: User-controlled ESPN browser session cookies for private leagues, a league ID and season year, and the ability to inspect browser network traffic locally if the user wants to chase queue or draft-room-specific behavior.
- **Success Criteria**: The implementation can reliably read league settings, detect draft order and draft status, reconstruct completed picks, pull ESPN rank/ADP-style player pool data, and clearly distinguish direct API facts from inferred estimates about queueing or auto-pick behavior.
