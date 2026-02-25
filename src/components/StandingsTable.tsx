import { StandingsEntry } from "@/types/league";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StandingsTableProps {
  standings: StandingsEntry[];
  humanTeamId: string;
  promotionSlots: number;
  relegationSlots: number;
}

export function StandingsTable({
  standings,
  humanTeamId,
  promotionSlots,
  relegationSlots,
}: StandingsTableProps) {
  const getPositionBadge = (position: number) => {
    if (position <= promotionSlots) {
      return <Badge variant="default">Promotion</Badge>;
    }
    if (position > standings.length - relegationSlots) {
      return <Badge variant="destructive">Relegation</Badge>;
    }
    return null;
  };

  const getWinPercentage = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return "0.000";
    return (wins / total).toFixed(3);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-center">W</TableHead>
            <TableHead className="text-center">L</TableHead>
            <TableHead className="text-center">PCT</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((entry, index) => {
            const position = index + 1;
            const isHumanTeam = entry.teamId === humanTeamId;

            return (
              <TableRow
                key={entry.teamId}
                className={isHumanTeam ? "bg-accent" : ""}
              >
                <TableCell className="font-medium">{position}</TableCell>
                <TableCell className={isHumanTeam ? "font-bold" : ""}>
                  {entry.teamName}
                  {isHumanTeam && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (You)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">{entry.wins}</TableCell>
                <TableCell className="text-center">{entry.losses}</TableCell>
                <TableCell className="text-center">
                  {getWinPercentage(entry.wins, entry.losses)}
                </TableCell>
                <TableCell>{getPositionBadge(position)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
