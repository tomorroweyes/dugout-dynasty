import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import RosterPanel from "@/components/RosterPanel";
import MatchPanel from "@/components/MatchPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { LeagueView } from "@/components/LeagueView";
import { SeasonResultsView } from "@/components/SeasonResultsView";
import { DraftView } from "@/components/DraftView";
import { StatDisplay } from "@/components/StatDisplay";
import { EquipmentManager } from "@/components/EquipmentManager";
import { Shop } from "@/components/Shop";
import { InteractiveMatchView } from "@/components/InteractiveMatchView";
import { PreGameCard } from "@/components/PreGameCard";
import { initializeInteractiveMatch } from "@/engine/interactiveMatchEngine";
import { generatePreGameContext } from "@/engine/preGameNarrative";
import { GAME_CONSTANTS } from "@/engine/constants";
import { Button } from "@/components/ui/8bit/button";
import { CardTitle } from "@/components/ui/8bit/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/8bit/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LevelUpToastContainer } from "@/components/ui/LevelUpToast";

type Page = "roster" | "game-log" | "league" | "equipment" | "shop" | "settings";

const VALID_TABS: Page[] = ["league", "roster", "equipment", "shop", "game-log", "settings"];

function getPageFromPath(pathname: string): Page {
  const segment = pathname.split("/").filter(Boolean)[0] || "league";
  if (VALID_TABS.includes(segment as Page)) return segment as Page;
  return "league";
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const { team, league, matchLog, pendingDraft, activeInteractiveMatch, initializeGame, playWeekMatch, completeWeek, advanceToNextSeason, resetGame, setActiveInteractiveMatch } = useGameStore();
  const { interactiveMatchMode, enable8bitTheme, enableEngineTrace } = useSettingsStore();

  // Opponent ID set when player clicks "Play Match" in interactive mode.
  // Drives the /pregame route — cleared once the match is actually started.
  const [pendingOpponentId, setPendingOpponentId] = useState<string | null>(null);

  // Apply retro theme class to document root
  useEffect(() => {
    const root = window.document.documentElement;
    if (enable8bitTheme) {
      root.classList.add("retro-theme");
    } else {
      root.classList.remove("retro-theme");
    }
  }, [enable8bitTheme]);

  // Auto-redirect to full-page views when game state requires them.
  // /pregame is excluded so the pre-game card isn't immediately clobbered.
  useEffect(() => {
    if (activeInteractiveMatch && location.pathname !== "/match") {
      navigate("/match", { replace: true });
    } else if (
      !activeInteractiveMatch &&
      pendingDraft &&
      location.pathname !== "/draft"
    ) {
      navigate("/draft", { replace: true });
    } else if (
      !activeInteractiveMatch &&
      !pendingDraft &&
      league?.isComplete &&
      league.seasonResult &&
      location.pathname !== "/season-results"
    ) {
      navigate("/season-results", { replace: true });
    }
  }, [
    activeInteractiveMatch,
    pendingDraft,
    league?.isComplete,
    league?.seasonResult,
    location.pathname,
    navigate,
  ]);

  /**
   * Called when the player clicks "Play This Week's Match" in LeagueView.
   *
   * - Interactive mode: find the opponent, navigate to /pregame so the
   *   player sees stakes before the first pitch.
   * - Auto-sim mode: unchanged — runs the match immediately.
   */
  const handlePlayMatch = () => {
    if (!team || !league) return;

    if (interactiveMatchMode) {
      const currentWeek = league.schedule.weeks[league.currentWeek];
      const myMatch = currentWeek?.matches.find(
        (m) =>
          m.homeTeamId === league.humanTeamId ||
          m.awayTeamId === league.humanTeamId
      );
      if (!myMatch) return;

      const opponentId =
        myMatch.homeTeamId === league.humanTeamId
          ? myMatch.awayTeamId
          : myMatch.homeTeamId;

      if (!league.teams.find((t) => t.id === opponentId)) return;

      // Park the opponent ID and let the /pregame route handle the rest
      setPendingOpponentId(opponentId);
      navigate("/pregame");
    } else {
      // Auto-sim — no pre-game screen needed
      playWeekMatch();
    }
  };

  /**
   * Actually kicks off the interactive match (called from PreGameCard's
   * "Play Ball!" and "Skip" buttons — identical outcome either way).
   */
  const handleStartMatch = (opponentId: string) => {
    if (!team || !league) return;
    const opponentTeam = league.teams.find((t) => t.id === opponentId);
    if (!opponentTeam) return;

    const matchState = initializeInteractiveMatch(
      { ...team, roster: team.roster },
      opponentTeam,
      undefined,
      enableEngineTrace
    );
    setActiveInteractiveMatch(matchState);
    setPendingOpponentId(null);
    navigate("/match");
  };

  const handleInteractiveMatchComplete = (result: MatchResult) => {
    // Apply the actual interactive match result to the league WITHOUT re-simulating
    const state = useGameStore.getState();
    const { team: currentTeam, league: currentLeague } = state;
    if (!currentTeam || !currentLeague) return;

    // Find this week's incomplete match from the schedule
    const currentWeek = currentLeague.schedule.weeks[currentLeague.currentWeek];
    if (!currentWeek) return;

    const myMatch = currentWeek.matches.find(
      (m) =>
        !m.completed &&
        (m.homeTeamId === currentLeague.humanTeamId ||
          m.awayTeamId === currentLeague.humanTeamId)
    );
    if (!myMatch) return;

    // Get opponent ID from the match
    const opponentId =
      myMatch.homeTeamId === currentLeague.humanTeamId
        ? myMatch.awayTeamId
        : myMatch.homeTeamId;

    // Find opponent team
    const opponentTeam = currentLeague.teams.find((t) => t.id === opponentId);
    if (!opponentTeam) return;

    // Get tier-specific rewards
    const tierConfig = GAME_CONSTANTS.LEAGUE_TIERS[currentLeague.tier];

    // Apply the result using the new action
    applyInteractiveMatchResult(result, currentTeam, opponentTeam, tierConfig.matchRewards);
    setActiveInteractiveMatch(null);
    navigate("/league", { replace: true });
  };

  return (
    <Routes>
      {/* Pre-game stakes card — shown before each interactive match */}
      <Route
        path="/pregame"
        element={(() => {
          if (!pendingOpponentId || !league || !team) {
            return <Navigate to="/league" replace />;
          }
          const opponentTeam = league.teams.find(
            (t) => t.id === pendingOpponentId
          );
          if (!opponentTeam) return <Navigate to="/league" replace />;

          const preGameCtx = generatePreGameContext(
            league,
            league.humanTeamId,
            opponentTeam,
            matchLog
          );
          const myStandingsEntry = league.standings.find(
            (s) => s.teamId === league.humanTeamId
          );

          return (
            <PreGameCard
              context={preGameCtx}
              myTeamName={myStandingsEntry?.teamName ?? "Your Team"}
              onPlay={() => handleStartMatch(pendingOpponentId)}
              onSkip={() => handleStartMatch(pendingOpponentId)}
            />
          );
        })()}
      />
      <Route
        path="/match"
        element={
          activeInteractiveMatch ? (
            <>
              <LevelUpToastContainer />
              <InteractiveMatchView
                initialState={activeInteractiveMatch}
                onComplete={handleInteractiveMatchComplete}
                matchRewards={league ? GAME_CONSTANTS.LEAGUE_TIERS[league.tier].matchRewards : undefined}
                fans={team?.fans}
              />
            </>
          ) : (
            <Navigate to="/league" replace />
          )
        }
      />
      <Route
        path="/draft"
        element={pendingDraft ? <DraftView /> : <Navigate to="/league" replace />}
      />
      <Route
        path="/season-results"
        element={
          league?.isComplete && league.seasonResult ? (
            <SeasonResultsView
              result={league.seasonResult}
              currentTier={league.tier}
              onContinue={() => {
                advanceToNextSeason();
                navigate("/league", { replace: true });
              }}
            />
          ) : (
            <Navigate to="/league" replace />
          )
        }
      />
      <Route
        path="/*"
        element={
          !team || !league ? (
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold">Dugout Dynasty</h1>
                <p className="text-muted-foreground">Baseball Management RPG</p>
                <Button onClick={initializeGame} size="lg">
                  Start New Game
                </Button>
              </div>
            </div>
          ) : (
            <TabsLayout
              team={team}
              league={league}
              currentPage={getPageFromPath(location.pathname)}
              onNavigate={(page) => navigate(`/${page}`)}
              onPlayMatch={handlePlayMatch}
              onCompleteWeek={completeWeek}
              resetGame={resetGame}
            />
          )
        }
      />
    </Routes>
  );
}

function TabsLayout({
  team,
  league,
  currentPage,
  onNavigate,
  onPlayMatch,
  onCompleteWeek,
  resetGame,
}: {
  team: NonNullable<ReturnType<typeof useGameStore.getState>["team"]>;
  league: NonNullable<ReturnType<typeof useGameStore.getState>["league"]>;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onPlayMatch: () => void;
  onCompleteWeek: () => void;
  resetGame: () => void;
}) {
  return (
    <>
      <LevelUpToastContainer />
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <header className="shrink-0 border-b p-4 bg-background text-foreground">
          <div className="container mx-auto flex justify-between items-center">
            <CardTitle className="text-2xl">Dugout Dynasty</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-4">
                <StatDisplay icon="💰" value={`$${team.cash.toLocaleString()}`} />
                <StatDisplay icon="👥" value={`${team.fans.toFixed(2)}x`} />
                <StatDisplay icon="📊" value={`${team.wins}-${team.losses}`} />
              </div>
              <ThemeToggle />
              <Button onClick={resetGame} variant="outline">
                Reset
              </Button>
            </div>
          </div>
        </header>

        <Tabs
          value={currentPage}
          onValueChange={(value) => onNavigate(value as Page)}
          className="flex-1 flex flex-col min-h-0 w-full"
        >
          <TabsList className="shrink-0 border-b w-full justify-start rounded-none bg-background">
            <TabsTrigger value="league" className="rounded-none">
              🏆 League
            </TabsTrigger>
            <TabsTrigger value="roster" className="rounded-none">
              ⚾ Roster
            </TabsTrigger>
            <TabsTrigger value="equipment" className="rounded-none">
              ⚙️ Equipment Manager
            </TabsTrigger>
            <TabsTrigger value="shop" className="rounded-none">
              🏪 Shop
            </TabsTrigger>
            <TabsTrigger value="game-log" className="rounded-none">
              📊 Game Log
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none">
              ⚙️ Settings
            </TabsTrigger>
          </TabsList>

          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-4">
              <TabsContent value="league">
                <LeagueView
                  league={league}
                  onPlayMatch={onPlayMatch}
                  onCompleteWeek={onCompleteWeek}
                />
              </TabsContent>
              <TabsContent value="roster">
                <RosterPanel />
              </TabsContent>
              <TabsContent value="equipment">
                <EquipmentManager />
              </TabsContent>
              <TabsContent value="shop">
                <Shop />
              </TabsContent>
              <TabsContent value="game-log">
                <MatchPanel />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsPanel />
              </TabsContent>
            </div>
          </main>
        </Tabs>

        <footer className="shrink-0 border-t px-4 py-2 text-center text-xs text-muted-foreground">
          Dugout Dynasty
        </footer>
      </div>
    </>
  );
}

export default App;
