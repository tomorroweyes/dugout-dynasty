import { useState, useRef, useEffect, useCallback } from "react";
import { Player } from "@/types/game";
import { getSkillTreeForClass } from "@/data/skillTrees";
import { getAbilityById } from "@/data/abilities";
import {
  canUnlockAbility,
  canUpgradeAbility,
  getPlayerAbility,
} from "@/engine/abilitySystem";
import { Button } from "@/components/ui/8bit/button";
import { Badge } from "@/components/ui/8bit/badge";
import { Card } from "@/components/ui/8bit/card";
import { Separator } from "@/components/ui/8bit/separator";
import { Lock, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillTreePanelProps {
  player: Player;
  onUnlockAbility: (playerId: string, abilityId: string) => void;
  onUpgradeAbility: (playerId: string, abilityId: string) => void;
}

const NODE_SIZE = 48;

export function SkillTreePanel({
  player,
  onUnlockAbility,
  onUpgradeAbility,
}: SkillTreePanelProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; unlocked: boolean }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const skillTree = player.class
    ? getSkillTreeForClass(player.class)
    : undefined;
  const hasTree = !!(skillTree && skillTree.nodes.length > 0);

  // Auto-select first node when tree becomes available
  useEffect(() => {
    if (hasTree && skillTree && !selectedId) {
      setSelectedId(skillTree.nodes[0].abilityId);
    }
  }, [hasTree, skillTree, selectedId]);

  // Calculate connection lines from node DOM positions
  const updateLines = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || !skillTree) return;
    const gridRect = grid.getBoundingClientRect();

    const newLines: typeof lines = [];
    for (const node of skillTree.nodes) {
      for (const prereqId of node.connections) {
        const fromEl = nodeRefs.current.get(prereqId);
        const toEl = nodeRefs.current.get(node.abilityId);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const fromUnlocked = player.abilities.some(
          (a) => a.abilityId === prereqId
        );
        const toUnlocked = player.abilities.some(
          (a) => a.abilityId === node.abilityId
        );

        newLines.push({
          x1: fromRect.left + fromRect.width / 2 - gridRect.left,
          y1: fromRect.top + fromRect.height / 2 - gridRect.top,
          x2: toRect.left + toRect.width / 2 - gridRect.left,
          y2: toRect.top + toRect.height / 2 - gridRect.top,
          unlocked: fromUnlocked && toUnlocked,
        });
      }
    }
    setLines(newLines);
  }, [skillTree, player.abilities]);

  useEffect(() => {
    if (!hasTree) return;
    const timer = setTimeout(updateLines, 50);
    return () => clearTimeout(timer);
  }, [hasTree, updateLines]);

  const setNodeRef = useCallback(
    (abilityId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        nodeRefs.current.set(abilityId, el);
      } else {
        nodeRefs.current.delete(abilityId);
      }
    },
    []
  );

  // Early returns after all hooks
  if (!player.class) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Reach level 5 to choose a class and unlock the skill tree.
        </p>
      </div>
    );
  }

  if (!hasTree || !skillTree) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Skill tree not available.</p>
      </div>
    );
  }

  // Grid dimensions
  const maxX = Math.max(...skillTree.nodes.map((n) => n.position.x));
  const maxY = Math.max(...skillTree.nodes.map((n) => n.position.y));

  // Selected ability details
  const selectedNode = skillTree.nodes.find(
    (n) => n.abilityId === selectedId
  );
  const selectedAbility = selectedNode
    ? getAbilityById(selectedNode.abilityId)
    : null;
  const selectedPlayerAbility = selectedNode
    ? player.abilities.find((a) => a.abilityId === selectedNode.abilityId)
    : null;
  const selectedIsUnlocked = !!selectedPlayerAbility;
  const selectedRank = selectedPlayerAbility?.rank || 0;
  const selectedScaled = selectedNode
    ? selectedIsUnlocked
      ? getPlayerAbility(player, selectedNode.abilityId)
      : selectedAbility
    : null;
  const selectedCanUnlock = selectedNode
    ? canUnlockAbility(player, selectedNode.abilityId)
    : { canUnlock: false, reason: "" };
  const selectedCanUpgrade = selectedNode
    ? canUpgradeAbility(player, selectedNode.abilityId)
    : { canUpgrade: false, reason: "" };

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{player.class} Skills</h3>
        <Badge variant="outline" className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          {player.skillPoints} SP
        </Badge>
      </div>

      <Separator />

      {/* Two-column layout: Tree + Detail */}
      <div className="flex gap-4">
        {/* Left: Visual node tree */}
        <div className="flex-1 flex items-center justify-center">
          <div ref={gridRef} className="relative py-4">
            {/* SVG connection lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {lines.map((line, i) => (
                <line
                  key={i}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  strokeWidth="2"
                  strokeDasharray={line.unlocked ? "0" : "4 4"}
                  className={
                    line.unlocked
                      ? "stroke-primary"
                      : "stroke-muted-foreground/30"
                  }
                />
              ))}
            </svg>

            {/* Node grid */}
            <div
              className="relative z-10 grid gap-y-6"
              style={{
                gridTemplateColumns: `repeat(${maxX + 1}, ${NODE_SIZE}px)`,
                columnGap: "2rem",
              }}
            >
              {Array.from({ length: maxY + 1 }, (_, y) =>
                Array.from({ length: maxX + 1 }, (_, x) => {
                  const node = skillTree.nodes.find(
                    (n) => n.position.x === x && n.position.y === y
                  );

                  if (!node) {
                    return (
                      <div
                        key={`${x}-${y}`}
                        style={{ width: NODE_SIZE, height: NODE_SIZE }}
                      />
                    );
                  }

                  const ability = getAbilityById(node.abilityId);
                  if (!ability) return <div key={`${x}-${y}`} />;

                  const playerAbility = player.abilities.find(
                    (a) => a.abilityId === node.abilityId
                  );
                  const isUnlocked = !!playerAbility;
                  const currentRank = playerAbility?.rank || 0;
                  const isMaxRank =
                    isUnlocked && currentRank >= ability.maxRank;
                  const { canUnlock } = canUnlockAbility(
                    player,
                    node.abilityId
                  );
                  const isSelected = selectedId === node.abilityId;
                  const isAvailable = !isUnlocked && canUnlock;
                  const isLocked = !isUnlocked && !canUnlock;

                  return (
                    <div
                      key={`${x}-${y}`}
                      className="flex items-center justify-center"
                    >
                      <div
                        ref={setNodeRef(node.abilityId)}
                        onClick={() => setSelectedId(node.abilityId)}
                        title={ability.name}
                        className={cn(
                          "relative rounded-full flex items-center justify-center transition-all duration-200",
                          isLocked &&
                            "border-2 border-muted bg-muted/20 grayscale cursor-not-allowed",
                          isAvailable &&
                            "border-2 border-primary/50 bg-background cursor-pointer hover:scale-110 hover:border-primary",
                          isUnlocked &&
                            !isMaxRank &&
                            "border-2 border-primary bg-primary/15 shadow-[0_0_12px] shadow-primary/40 cursor-pointer hover:scale-110",
                          isMaxRank &&
                            "border-2 border-amber-500 bg-amber-500/15 shadow-[0_0_12px] shadow-amber-500/40 cursor-pointer hover:scale-110",
                          isSelected &&
                            "ring-2 ring-ring ring-offset-2 ring-offset-background"
                        )}
                        style={{ width: NODE_SIZE, height: NODE_SIZE }}
                      >
                        <span className="text-xl leading-none">
                          {ability.iconEmoji || "⚡"}
                        </span>

                        {isUnlocked && (
                          <Badge
                            className={cn(
                              "absolute -top-1 -right-1 h-4 min-w-4 px-0.5 text-[7px] font-bold justify-center",
                              isMaxRank
                                ? "bg-amber-500 text-white"
                                : "bg-primary text-primary-foreground"
                            )}
                          >
                            {currentRank}
                          </Badge>
                        )}

                        {isLocked && (
                          <Lock className="absolute bottom-0 right-0 w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="w-45 shrink-0">
          {selectedAbility ? (
            <Card className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">
                  {selectedAbility.iconEmoji || "⚡"}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-xs leading-tight">
                    {selectedAbility.name}
                  </h4>
                  {selectedIsUnlocked && (
                    <Badge
                      variant="outline"
                      className="text-[8px] mt-1 px-1 py-0"
                    >
                      Rank {selectedRank}/{selectedAbility.maxRank}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-snug">
                {selectedAbility.description}
              </p>

              <Separator />

              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {selectedScaled?.spiritCost || selectedAbility.spiritCost} SP
                </span>
                <span className="text-muted-foreground">
                  Lv {selectedAbility.requiredLevel}
                </span>
              </div>

              <Separator />

              {!selectedIsUnlocked && selectedCanUnlock.canUnlock ? (
                <Button
                  size="sm"
                  className="w-full h-7 text-[10px]"
                  onClick={() => onUnlockAbility(player.id, selectedId)}
                >
                  Unlock (1 SP)
                </Button>
              ) : !selectedIsUnlocked ? (
                <p className="text-[10px] text-muted-foreground text-center py-1">
                  {selectedCanUnlock.reason}
                </p>
              ) : selectedRank < selectedAbility.maxRank ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px]"
                  disabled={!selectedCanUpgrade.canUpgrade}
                  onClick={() => onUpgradeAbility(player.id, selectedId)}
                  title={selectedCanUpgrade.reason}
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Upgrade (1 SP)
                </Button>
              ) : (
                <Badge
                  variant="outline"
                  className="w-full justify-center text-[10px] py-1"
                >
                  MAX RANK
                </Badge>
              )}
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[10px] text-muted-foreground text-center">
                Select an ability
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
