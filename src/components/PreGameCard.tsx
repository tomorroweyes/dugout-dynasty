/**
 * PreGameCard — Stakes screen shown before each interactive match.
 *
 * Surfaces 1-3 contextual narrative hooks (standings, streaks, history)
 * to give the player a sense of what's at stake before the first pitch.
 *
 * Fully dismissible — "Skip" jumps straight to the match for players
 * who want zero friction.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { PreGameContext } from "@/engine/preGameNarrative";

interface PreGameCardProps {
  context: PreGameContext;
  myTeamName?: string;
  onPlay: () => void;
  onSkip: () => void;
}

function recordLabel(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function PreGameCard({
  context,
  myTeamName = "Your Team",
  onPlay,
  onSkip,
}: PreGameCardProps) {
  const { opponentName, myRecord, opponentRecord, hookLines, myStandingsPos, totalTeams, gamesRemaining } =
    context;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Header — Pre-game label */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            ⚾ Game Day
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {myTeamName}
            <span className="text-muted-foreground font-normal mx-3">vs</span>
            {opponentName}
          </h1>
        </div>

        {/* Record summary */}
        <div className="flex items-center justify-center gap-8 py-2">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">
              {recordLabel(myRecord.wins, myRecord.losses)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
              You
            </p>
          </div>

          <div className="text-center text-muted-foreground">
            <p className="text-sm">#{myStandingsPos} of {totalTeams}</p>
            {gamesRemaining > 0 && (
              <p className="text-xs">{gamesRemaining}G left</p>
            )}
          </div>

          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-muted-foreground">
              {recordLabel(opponentRecord.wins, opponentRecord.losses)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
              {opponentName.split(" ").pop()}
            </p>
          </div>
        </div>

        <Separator />

        {/* Narrative hook lines — the heart of the card */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            What's at stake
          </p>
          {hookLines.map((line, i) => (
            <div
              key={i}
              className={`flex gap-3 items-start rounded-md p-3 border ${
                i === 0
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border bg-card/40"
              }`}
            >
              {i === 0 && (
                <span className="mt-0.5 text-amber-500 shrink-0" aria-hidden>
                  ⚡
                </span>
              )}
              {i > 0 && (
                <span className="mt-0.5 text-muted-foreground shrink-0" aria-hidden>
                  •
                </span>
              )}
              <p className={`text-sm leading-snug ${i === 0 ? "font-medium" : "text-muted-foreground"}`}>
                {line}
              </p>
            </div>
          ))}
        </div>

        {/* Standings badge — subtle context */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {ordinal(myStandingsPos)} place
          </Badge>
          {gamesRemaining === 1 && (
            <Badge variant="destructive" className="text-xs">
              Final game
            </Badge>
          )}
          {gamesRemaining === 2 && (
            <Badge variant="outline" className="text-xs border-orange-500/40 text-orange-500">
              2 games left
            </Badge>
          )}
        </div>

        <Separator />

        {/* CTA */}
        <div className="flex gap-3 pt-1">
          <Button
            onClick={onPlay}
            size="lg"
            className="flex-1 text-base font-bold"
          >
            ⚾ Play Ball!
          </Button>
          <Button
            onClick={onSkip}
            variant="ghost"
            size="lg"
            className="text-muted-foreground"
          >
            Skip
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground/50">
          "Skip" goes straight to the match
        </p>
      </div>
    </div>
  );
}
