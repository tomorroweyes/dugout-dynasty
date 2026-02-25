import { MatchResult, PlayOutcome } from "@/types/game";
import { STAT_TIER_COLORS } from "@/engine/statConfig";
import {
  getOutcomeDisplayText,
  getOutcomeColorClass,
  getOutcomeHighlightWord,
} from "@/engine/outcomeConfig";

interface PlayByPlayProps {
  match: MatchResult;
}

function PlayByPlay({ match }: PlayByPlayProps) {
  const playByPlay = match.playByPlay;

  if (!playByPlay || playByPlay.length === 0) {
    return null;
  }

  // Group plays by inning and half
  // Determine max inning from actual plays
  const maxInning = Math.max(...playByPlay.map((p) => p.inning));
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1);

  // Calculate running score for each inning
  let myScore = 0;
  let opponentScore = 0;
  const inningScores: Record<string, { my: number; opponent: number }> = {};

  playByPlay.forEach((play) => {
    if (play.isTop) {
      opponentScore += play.rbi || 0;
    } else {
      myScore += play.rbi || 0;
    }

    // Store score after each half-inning
    const lastPlayInHalf = playByPlay.filter(
      (p) => p.inning === play.inning && p.isTop === play.isTop
    );
    if (lastPlayInHalf[lastPlayInHalf.length - 1] === play) {
      inningScores[`${play.inning}-${play.isTop ? "top" : "bottom"}`] = {
        my: myScore,
        opponent: opponentScore,
      };
    }
  });

  const getOutcomeColor = (outcome: PlayOutcome) => {
    return getOutcomeColorClass(outcome);
  };

  const renderOutcomeText = (outcome: PlayOutcome, rbi: number | undefined) => {
    const text = getOutcomeDisplayText(outcome, rbi);
    const colorClass = getOutcomeColor(outcome);
    const outcomeWord = getOutcomeHighlightWord(outcome);

    // Use case-insensitive search to find the outcome word
    const lowerText = text.toLowerCase();
    const lowerOutcome = outcomeWord.toLowerCase();
    const index = lowerText.indexOf(lowerOutcome);

    if (index === -1) {
      // Fallback if we can't find the outcome word
      return <span className={colorClass}>{text}</span>;
    }

    const beforeOutcome = text.substring(0, index);
    const actualOutcome = text.substring(index, index + outcomeWord.length);
    const afterOutcome = text.substring(index + outcomeWord.length);

    // Color the outcome word
    const coloredOutcome = <span className={colorClass}>{actualOutcome}</span>;

    // If there's an RBI, highlight it too
    if (rbi && rbi > 0) {
      const rbiText = `${rbi} RBI`;
      const rbiIndex = afterOutcome.indexOf(rbiText);

      if (rbiIndex !== -1) {
        const beforeRbi = afterOutcome.substring(0, rbiIndex);
        const afterRbi = afterOutcome.substring(rbiIndex + rbiText.length);

        return (
          <>
            {beforeOutcome}
            {coloredOutcome}
            {beforeRbi}
            <span className={`font-bold ${STAT_TIER_COLORS.GOOD.text}`}>
              {rbiText}
            </span>
            {afterRbi}
          </>
        );
      }
    }

    return (
      <>
        {beforeOutcome}
        {coloredOutcome}
        {afterOutcome}
      </>
    );
  };

  return (
    <div className="border-t p-3 bg-background/50">
      <div className="space-y-4">
        {innings.map((inning) => {
          const topPlays = playByPlay.filter(
            (p) => p.inning === inning && p.isTop
          );
          const bottomPlays = playByPlay.filter(
            (p) => p.inning === inning && !p.isTop
          );

          if (topPlays.length === 0 && bottomPlays.length === 0) {
            return null;
          }

          const topScore = inningScores[`${inning}-top`];
          const bottomScore = inningScores[`${inning}-bottom`];

          const getInningOrdinal = (n: number) => {
            if (n === 1) return "st";
            if (n === 2) return "nd";
            if (n === 3) return "rd";
            return "th";
          };

          return (
            <div key={inning} className="border-b pb-3 last:border-b-0">
              {/* Top of Inning */}
              {topPlays.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold text-sm mb-2 sticky top-0 bg-background/90 py-1">
                    Top {inning}
                    {getInningOrdinal(inning)}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {topPlays.map((play, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 w-12 shrink-0">
                          {play.outs} {play.outs === 1 ? "out" : "outs"}
                        </span>
                        <span className="flex-1">
                          {play.narrativeText ? (
                            // Phase 3: Display narrative text
                            <span className="text-foreground">
                              {play.narrativeText}
                            </span>
                          ) : (
                            // Fallback to old format
                            <>
                              <span className="font-semibold text-foreground">
                                {play.batter}
                              </span>{" "}
                              {renderOutcomeText(play.outcome, play.rbi)}
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {topScore && bottomPlays.length === 0 && (
                    <div className="mt-2 pt-2 border-t text-xs font-mono text-center text-muted-foreground">
                      Score: Opponent {topScore.opponent} - You {topScore.my}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom of Inning */}
              {bottomPlays.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 sticky top-0 bg-background/90 py-1">
                    Bottom {inning}
                    {getInningOrdinal(inning)}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    {bottomPlays.map((play, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-muted-foreground"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 w-12 shrink-0">
                          {play.outs} {play.outs === 1 ? "out" : "outs"}
                        </span>
                        <span className="flex-1">
                          {play.narrativeText ? (
                            // Phase 3: Display narrative text
                            <span className="text-foreground">
                              {play.narrativeText}
                            </span>
                          ) : (
                            // Fallback to old format
                            <>
                              <span className="font-semibold text-foreground">
                                {play.batter}
                              </span>{" "}
                              {renderOutcomeText(play.outcome, play.rbi)}
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* End of Inning Score */}
                  {bottomScore && (
                    <div className="mt-2 pt-2 border-t text-xs font-mono text-center text-muted-foreground">
                      Score: Opponent {bottomScore.opponent} - You{" "}
                      {bottomScore.my}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayByPlay;
