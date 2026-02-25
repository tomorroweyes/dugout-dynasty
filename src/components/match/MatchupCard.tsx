import { Sparkles, Zap } from "lucide-react";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";
import { GAME_CONSTANTS } from "@/engine/constants";
import type { InteractiveMatchState } from "@/engine/interactiveMatchEngine";
import type { BatterSeasonStats, PitcherSeasonStats } from "@/types/game";

interface MatchupCardProps {
  matchState: InteractiveMatchState;
  isMyBatter: boolean;
  myTeamColor: string | undefined;
  opponentTeamColor: string | undefined;
}

export function MatchupCard({
  matchState,
  isMyBatter,
  myTeamColor,
  opponentTeamColor,
}: MatchupCardProps) {
  const plays = matchState.playByPlay;
  const batterName = matchState.currentBatter.name;
  const pitcherName = matchState.currentPitcher.name;

  // In-game stat lines
  const batterPlays = plays.filter((p) => p.batter === batterName);
  const hitOutcomes = ["single", "double", "triple", "homerun"];
  const atBats = batterPlays.filter((p) => p.outcome !== "walk").length;
  const hits = batterPlays.filter((p) => hitOutcomes.includes(p.outcome)).length;
  const hrs = batterPlays.filter((p) => p.outcome === "homerun").length;
  const rbi = batterPlays.reduce((sum, p) => sum + (p.rbi || 0), 0);
  const batterKs = batterPlays.filter((p) => p.outcome === "strikeout").length;
  const batterAbilitiesUsed = batterPlays.filter((p) => p.batterAbilityUsed).length;

  const pitcherPlays = plays.filter((p) => p.pitcher === pitcherName);
  const pitcherKs = pitcherPlays.filter((p) => p.outcome === "strikeout").length;
  const walks = pitcherPlays.filter((p) => p.outcome === "walk").length;
  const hitsAllowed = pitcherPlays.filter((p) => hitOutcomes.includes(p.outcome)).length;
  const pitcherAbilitiesUsed = pitcherPlays.filter((p) => p.pitcherAbilityUsed).length;

  // Season stats (batter AVG only — compact)
  const bSeason = matchState.currentBatter.seasonStats as BatterSeasonStats | undefined;
  const pSeason = matchState.currentPitcher.seasonStats as PitcherSeasonStats | undefined;
  const hasBatter = bSeason && bSeason.gamesPlayed > 0;
  const hasPitcher = pSeason && pSeason.gamesPlayed > 0;
  const avg =
    hasBatter && bSeason.atBats > 0
      ? (bSeason.hits / bSeason.atBats).toFixed(3).replace(/^0/, "")
      : null;
  const era =
    hasPitcher && pSeason.inningsPitched > 0
      ? ((pSeason.runsAllowed * 9) / pSeason.inningsPitched).toFixed(2)
      : null;

  // Pitcher fatigue
  const inningsPitched = isMyBatter
    ? matchState.opponentPitcherInnings
    : matchState.myPitcherInnings;
  const extraFatigue = isMyBatter
    ? matchState.opponentPitcherExtraFatigue
    : matchState.myPitcherExtraFatigue;
  const totalFatigue = inningsPitched + extraFatigue;
  const lossPer = GAME_CONSTANTS.PITCHER_FATIGUE.EFFECTIVENESS_LOSS_PER_INNING;
  const minEff = GAME_CONSTANTS.PITCHER_FATIGUE.MINIMUM_EFFECTIVENESS;
  const effectiveness = Math.max(minEff, 1 - totalFatigue * lossPer);
  const pct = Math.round(effectiveness * 100);
  const fatigueColor =
    pct > 85 ? "bg-green-500" : pct > 75 ? "bg-yellow-500" : pct > 70 ? "bg-orange-500" : "bg-red-500";

  // Spirit deltas
  const batterDelta = matchState.lastSpiritDelta?.batterId === matchState.currentBatter.id
    ? matchState.lastSpiritDelta.batterDelta
    : undefined;
  const pitcherDelta = matchState.lastSpiritDelta?.pitcherId === matchState.currentPitcher.id
    ? matchState.lastSpiritDelta.pitcherDelta
    : undefined;

  return (
    <div className="shrink-0 border border-border rounded-lg bg-card px-3 py-2 space-y-2">
      {/* Players row */}
      <div className="flex items-center gap-2">
        {/* Batter */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img
            src={generatePlayerAvatar(matchState.currentBatter.name, "pixelArt", {
              teamColor: isMyBatter ? myTeamColor : opponentTeamColor,
            })}
            alt={matchState.currentBatter.name}
            className="w-8 h-8 rounded border border-blue-500/40 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-xs truncate leading-tight">
              {matchState.currentBatter.name}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {matchState.currentBatter.spirit && (
                <span className="flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-blue-400" />
                  {matchState.currentBatter.spirit.current}
                  {batterDelta !== undefined && batterDelta !== 0 && (
                    <span className={`font-bold ${batterDelta > 0 ? "text-green-500" : "text-red-400"}`}>
                      {batterDelta > 0 ? "+" : ""}{batterDelta}
                    </span>
                  )}
                </span>
              )}
              {batterAbilitiesUsed > 0 && (
                <span className="flex items-center gap-0.5 text-blue-500">
                  <Sparkles className="w-2.5 h-2.5" />{batterAbilitiesUsed}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="text-[10px] font-bold text-muted-foreground/50 shrink-0">VS</div>

        {/* Pitcher */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <div className="font-bold text-xs truncate leading-tight">
              {matchState.currentPitcher.name}
            </div>
            <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
              {pitcherAbilitiesUsed > 0 && (
                <span className="flex items-center gap-0.5 text-red-500">
                  <Sparkles className="w-2.5 h-2.5" />{pitcherAbilitiesUsed}
                </span>
              )}
              {matchState.currentPitcher.spirit && (
                <span className="flex items-center gap-0.5">
                  {pitcherDelta !== undefined && pitcherDelta !== 0 && (
                    <span className={`font-bold ${pitcherDelta > 0 ? "text-green-500" : "text-red-400"}`}>
                      {pitcherDelta > 0 ? "+" : ""}{pitcherDelta}
                    </span>
                  )}
                  <Zap className="w-2.5 h-2.5 text-purple-400" />
                  {matchState.currentPitcher.spirit.current}
                </span>
              )}
            </div>
          </div>
          <img
            src={generatePlayerAvatar(matchState.currentPitcher.name, "pixelArt", {
              teamColor: isMyBatter ? opponentTeamColor : myTeamColor,
            })}
            alt={matchState.currentPitcher.name}
            className="w-8 h-8 rounded border border-red-500/40 shrink-0"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-1 text-[10px]">
        {/* Batter stats */}
        <div className="flex-1 flex gap-1.5 text-muted-foreground">
          <span>
            <span className="font-bold text-foreground">{hits}</span>-{atBats}
          </span>
          {hrs > 0 && <span><span className="font-bold text-foreground">{hrs}</span> HR</span>}
          {rbi > 0 && <span><span className="font-bold text-foreground">{rbi}</span> RBI</span>}
          {batterKs > 0 && <span><span className="font-bold text-foreground">{batterKs}</span> K</span>}
          {avg && <span className="text-muted-foreground/50">{avg}</span>}
        </div>

        {/* Pitcher fatigue + stats */}
        <div className="flex-1 flex items-center justify-end gap-1.5 text-muted-foreground">
          {era && <span className="text-muted-foreground/50">{era} ERA</span>}
          <span><span className="font-bold text-foreground">{pitcherKs}</span> K</span>
          <span><span className="font-bold text-foreground">{walks}</span> BB</span>
          <span><span className="font-bold text-foreground">{hitsAllowed}</span> H</span>
        </div>
      </div>

      {/* Pitcher arm bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted-foreground shrink-0">Arm</span>
        <div className="relative flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 bottom-0 rounded-full ${fatigueColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0 w-7 text-right">{pct}%</span>
      </div>
    </div>
  );
}
