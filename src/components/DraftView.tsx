import { useMemo } from "react";
import { Player, DraftState, isPitcher, BatterStats, PitcherStats, PlayerTrait } from "@/types/game";
import { useGameStore } from "@/store/gameStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/8bit/button";
import { Badge } from "@/components/ui/8bit/badge";
import { Separator } from "@/components/ui/separator";
import { Flame, Wind, User } from "lucide-react";
import {
  getBatterOverall,
  getPitcherOverall,
  getStatColor,
} from "@/engine/statConfig";
import { generatePlayerAvatar } from "@/utils/avatarGenerator";
import { cn } from "@/lib/utils";
import { TRAIT_EMOJI } from "@/engine/synergyConfig";
import { countTraits, getSynergyHints } from "@/engine/synergySystem";

function getOverall(player: Player): number {
  return isPitcher(player)
    ? getPitcherOverall(player.stats as PitcherStats)
    : getBatterOverall(player.stats as BatterStats);
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  Starter: <Flame className="w-4 h-4 inline-block" />,
  Reliever: <Wind className="w-4 h-4 inline-block" />,
  Batter: <User className="w-4 h-4 inline-block" />,
};

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm", getStatColor(value))}>{value}</span>
    </div>
  );
}

function CandidateCard({
  player,
  onSelect,
  currentTraitCounts,
}: {
  player: Player;
  onSelect: () => void;
  currentTraitCounts?: Record<PlayerTrait, number>;
}) {
  const overall = getOverall(player);
  const isPit = isPitcher(player);
  const stats = player.stats;

  // Get synergy completion hints
  const hints = useMemo(() => {
    if (!currentTraitCounts || !player.traits?.length) return [];
    return getSynergyHints(currentTraitCounts, player.traits);
  }, [currentTraitCounts, player.traits]);

  return (
    <Card className={cn("hover:shadow-lg transition-shadow", hints.length > 0 && "ring-2 ring-green-500/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-border flex-shrink-0">
            <img
              src={generatePlayerAvatar(player.name, "pixelArt")}
              alt={player.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{player.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {ROLE_ICON[player.role]} {player.role}
              </Badge>
              <Badge className="text-xs bg-amber-500 text-white">
                OVR {overall}
              </Badge>
              {/* Trait badges */}
              {player.traits?.map((trait) => (
                <Badge key={trait} variant="outline" className="text-xs px-1.5 py-0">
                  {TRAIT_EMOJI[trait]} {trait}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Synergy completion hints */}
        {hints.length > 0 && (
          <div className="space-y-1">
            {hints.map((hint, i) => (
              <div key={i} className="text-xs text-green-600 font-medium">
                {hint.emoji} Completes {hint.synergyName} ({hint.tier})!
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {isPit ? (
            <>
              <StatRow label="Velocity" value={(stats as PitcherStats).velocity} />
              <StatRow label="Control" value={(stats as PitcherStats).control} />
              <StatRow label="Break" value={(stats as PitcherStats).break} />
            </>
          ) : (
            <>
              <StatRow label="Power" value={(stats as BatterStats).power} />
              <StatRow label="Contact" value={(stats as BatterStats).contact} />
              <StatRow label="Glove" value={(stats as BatterStats).glove} />
              <StatRow label="Speed" value={(stats as BatterStats).speed} />
            </>
          )}
        </div>

        <Button onClick={onSelect} className="w-full" size="sm">
          Draft Player
        </Button>
      </CardContent>
    </Card>
  );
}

export function DraftView() {
  const pendingDraft = useGameStore((s) => s.pendingDraft) as DraftState;
  const pickDraftPlayer = useGameStore((s) => s.pickDraftPlayer);
  const team = useGameStore((s) => s.team);

  const currentSlot = pendingDraft.slots[pendingDraft.currentSlotIndex];
  const totalSlots = pendingDraft.slots.length;
  const currentPick = pendingDraft.currentSlotIndex + 1;

  // Compute current trait counts (existing roster + already drafted)
  const currentTraitCounts = useMemo(() => {
    const allPlayers = [
      ...(team?.roster ?? []),
      ...pendingDraft.picks,
    ];
    return countTraits(allPlayers);
  }, [team?.roster, pendingDraft.picks]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Roster Expansion Draft</CardTitle>
          <CardDescription className="text-lg">
            Your team has been promoted to the{" "}
            <span className="font-semibold text-foreground">
              {pendingDraft.toTier}
            </span>{" "}
            league! Draft new players to fill your roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Pick {currentPick} of {totalSlots}
            </span>
            <Badge variant="outline">
              {ROLE_ICON[currentSlot.role]} Select a {currentSlot.role}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-accent rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(pendingDraft.picks.length / totalSlots) * 100}%`,
              }}
            />
          </div>

          {/* Candidate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentSlot.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                player={candidate}
                onSelect={() => pickDraftPlayer(candidate)}
                currentTraitCounts={currentTraitCounts}
              />
            ))}
          </div>

          {/* Already drafted players */}
          {pendingDraft.picks.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                  Drafted Players
                </h3>
                <div className="flex flex-wrap gap-2">
                  {pendingDraft.picks.map((p) => (
                    <Badge key={p.id} variant="secondary">
                      {ROLE_ICON[p.role]} {p.name} (OVR {getOverall(p)})
                      {p.traits?.map((t) => ` ${TRAIT_EMOJI[t]}`)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
