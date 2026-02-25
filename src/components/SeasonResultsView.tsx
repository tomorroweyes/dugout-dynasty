import { SeasonResult, LeagueTier } from "@/types/league";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SeasonResultsViewProps {
  result: SeasonResult;
  currentTier: LeagueTier;
  onContinue: () => void;
}

export function SeasonResultsView({
  result,
  onContinue,
}: SeasonResultsViewProps) {
  const getResultIcon = () => {
    if (result.finalPosition === 1) {
      return <Trophy className="h-12 w-12 text-yellow-500" />;
    }
    if (result.promoted) {
      return <TrendingUp className="h-12 w-12 text-green-500" />;
    }
    if (result.relegated) {
      return <TrendingDown className="h-12 w-12 text-red-500" />;
    }
    return <Minus className="h-12 w-12 text-gray-500" />;
  };

  const getResultMessage = () => {
    if (result.finalPosition === 1) {
      return "League Champions!";
    }
    if (result.promoted) {
      return "Promoted!";
    }
    if (result.relegated) {
      return "Relegated";
    }
    return "Season Complete";
  };

  const getResultDescription = () => {
    if (result.finalPosition === 1) {
      return "You won the league championship!";
    }
    if (result.promoted) {
      return `You finished in ${getOrdinal(result.finalPosition)} place and earned promotion to the ${result.nextTier} tier!`;
    }
    if (result.relegated) {
      return `You finished in ${getOrdinal(result.finalPosition)} place and were relegated to the ${result.nextTier} tier.`;
    }
    return `You finished in ${getOrdinal(result.finalPosition)} place.`;
  };

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">{getResultIcon()}</div>
          <CardTitle className="text-3xl">{getResultMessage()}</CardTitle>
          <CardDescription className="text-lg">
            {getResultDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Season Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-accent">
              <div className="text-3xl font-bold">{result.totalWins}</div>
              <div className="text-sm text-muted-foreground">Wins</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent">
              <div className="text-3xl font-bold">{result.totalLosses}</div>
              <div className="text-sm text-muted-foreground">Losses</div>
            </div>
          </div>

          <Separator />

          {/* Rewards */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Season Rewards</h3>
            <div className="space-y-2">
              {result.cashPrize > 0 && (
                <div className="flex justify-between items-center">
                  <span>Prize Money</span>
                  <Badge variant="default">+${result.cashPrize.toLocaleString()}</Badge>
                </div>
              )}
              {result.scoutPoints > 0 && (
                <div className="flex justify-between items-center">
                  <span>Scout Points</span>
                  <Badge variant="secondary">+{result.scoutPoints}</Badge>
                </div>
              )}
              {result.fanBonus > 0 && (
                <div className="flex justify-between items-center">
                  <span>Fan Growth</span>
                  <Badge variant="secondary">
                    +{(result.fanBonus * 100).toFixed(0)}%
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Next Season Info */}
          {result.nextTier && (
            <div className="text-center p-4 rounded-lg bg-accent">
              <div className="text-sm text-muted-foreground mb-1">
                Next Season
              </div>
              <div className="text-xl font-bold">{result.nextTier} League</div>
            </div>
          )}

          {/* Continue Button */}
          <Button onClick={onContinue} size="lg" className="w-full">
            {result.nextTier ? "Start Next Season" : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
