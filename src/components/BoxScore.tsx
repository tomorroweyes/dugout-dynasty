import { MatchResult } from "@/types/game";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/8bit/tabs";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";

interface BoxScoreProps {
  match: MatchResult;
}

function BoxScore({ match }: BoxScoreProps) {
  const boxScore = match.boxScore;

  if (!boxScore) {
    return null;
  }

  // Convert hex colors to format expected by avatar generator (without #)
  const myTeamColor = match.myTeamColor?.replace("#", "");
  const opponentTeamColor = match.opponentTeamColor?.replace("#", "");

  return (
    <div className="border-t p-3 bg-background/50">
      {/* Team Stats Summary */}
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center pb-2 border-b">
          <div>Team</div>
          <div>Runs</div>
          <div>Hits</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
          <div>You</div>
          <div className="font-bold">{match.myRuns}</div>
          <div>{boxScore.myHits}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center pb-2">
          <div>Opponent</div>
          <div className="font-bold">{match.opponentRuns}</div>
          <div>{boxScore.opponentHits}</div>
        </div>
      </div>

      <Tabs defaultValue="your-team" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="your-team">Your Team</TabsTrigger>
          <TabsTrigger value="opponent">Opponent</TabsTrigger>
        </TabsList>

        <TabsContent value="your-team" className="space-y-4">
          {/* Your Batting */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Batters</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1">Player</th>
                    <th className="text-center pb-1">AB</th>
                    <th className="text-center pb-1">H</th>
                    <th className="text-center pb-1">R</th>
                    <th className="text-center pb-1">RBI</th>
                    <th className="text-center pb-1">K</th>
                    <th className="text-center pb-1">BB</th>
                  </tr>
                </thead>
                <tbody>
                  {boxScore.myBatters.map((batter) => (
                    <tr key={batter.playerId} className="border-b">
                      <td className="py-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={generatePlayerAvatar(batter.name, "pixelArt", {
                              teamColor: myTeamColor,
                            })}
                            alt={batter.name}
                            className="w-6 h-6 rounded border"
                          />
                          <span>{batter.name}</span>
                        </div>
                      </td>
                      <td className="text-center">{batter.atBats}</td>
                      <td className="text-center">{batter.hits}</td>
                      <td className="text-center">{batter.runs}</td>
                      <td className="text-center">{batter.rbis}</td>
                      <td className="text-center">{batter.strikeouts}</td>
                      <td className="text-center">{batter.walks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Your Pitching */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Pitchers</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1">Player</th>
                    <th className="text-center pb-1">IP</th>
                    <th className="text-center pb-1">H</th>
                    <th className="text-center pb-1">R</th>
                    <th className="text-center pb-1">K</th>
                    <th className="text-center pb-1">BB</th>
                  </tr>
                </thead>
                <tbody>
                  {boxScore.myPitchers.map((pitcher) => (
                    <tr key={pitcher.playerId} className="border-b">
                      <td className="py-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={generatePlayerAvatar(pitcher.name, "pixelArt", {
                              teamColor: myTeamColor,
                            })}
                            alt={pitcher.name}
                            className="w-6 h-6 rounded border"
                          />
                          <span>{pitcher.name}</span>
                        </div>
                      </td>
                      <td className="text-center">{pitcher.inningsPitched}</td>
                      <td className="text-center">{pitcher.hitsAllowed}</td>
                      <td className="text-center">{pitcher.runsAllowed}</td>
                      <td className="text-center">{pitcher.strikeouts}</td>
                      <td className="text-center">{pitcher.walks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="opponent" className="space-y-4">
          {/* Opponent Batting */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Batters</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1">Player</th>
                    <th className="text-center pb-1">AB</th>
                    <th className="text-center pb-1">H</th>
                    <th className="text-center pb-1">R</th>
                    <th className="text-center pb-1">RBI</th>
                    <th className="text-center pb-1">K</th>
                    <th className="text-center pb-1">BB</th>
                  </tr>
                </thead>
                <tbody>
                  {boxScore.opponentBatters.map((batter) => (
                    <tr key={batter.playerId} className="border-b">
                      <td className="py-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={generatePlayerAvatar(batter.name, "pixelArt", {
                              teamColor: opponentTeamColor,
                            })}
                            alt={batter.name}
                            className="w-6 h-6 rounded border"
                          />
                          <span>{batter.name}</span>
                        </div>
                      </td>
                      <td className="text-center">{batter.atBats}</td>
                      <td className="text-center">{batter.hits}</td>
                      <td className="text-center">{batter.runs}</td>
                      <td className="text-center">{batter.rbis}</td>
                      <td className="text-center">{batter.strikeouts}</td>
                      <td className="text-center">{batter.walks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Opponent Pitching */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Pitchers</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1">Player</th>
                    <th className="text-center pb-1">IP</th>
                    <th className="text-center pb-1">H</th>
                    <th className="text-center pb-1">R</th>
                    <th className="text-center pb-1">K</th>
                    <th className="text-center pb-1">BB</th>
                  </tr>
                </thead>
                <tbody>
                  {boxScore.opponentPitchers.map((pitcher) => (
                    <tr key={pitcher.playerId} className="border-b">
                      <td className="py-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={generatePlayerAvatar(pitcher.name, "pixelArt", {
                              teamColor: opponentTeamColor,
                            })}
                            alt={pitcher.name}
                            className="w-6 h-6 rounded border"
                          />
                          <span>{pitcher.name}</span>
                        </div>
                      </td>
                      <td className="text-center">{pitcher.inningsPitched}</td>
                      <td className="text-center">{pitcher.hitsAllowed}</td>
                      <td className="text-center">{pitcher.runsAllowed}</td>
                      <td className="text-center">{pitcher.strikeouts}</td>
                      <td className="text-center">{pitcher.walks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default BoxScore;
