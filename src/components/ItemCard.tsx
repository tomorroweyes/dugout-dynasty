import { Item, ItemRarity, EquipmentSlot, EQUIPMENT_SLOT_NAMES, RARITY_CONFIG } from "@/types/item";
import { getRarityColor } from "@/engine/raritySystem";
import { Card } from "./ui/8bit/card";
import { Badge } from "./ui/8bit/badge";
import { Sparkles, TrendingUp, TrendingDown, Hand, FootprintsIcon, Glasses, HardHat, CircleDot } from "lucide-react";

const SLOT_ICONS: Record<EquipmentSlot, React.ComponentType<{ className?: string }>> = {
  bat: CircleDot,
  glove: Hand,
  cap: HardHat,
  cleats: FootprintsIcon,
  accessory: Glasses,
};

// Static glow map — dynamic template literals get purged by Tailwind
const RARITY_GLOW: Record<ItemRarity, string> = {
  junk:      "via-zinc-400/10",
  common:    "via-slate-400/10",
  uncommon:  "via-emerald-500/20",
  rare:      "via-sky-500/25",
  epic:      "via-violet-500/30",
  legendary: "via-amber-500/40",
};

const STAT_ABBR: Record<string, string> = {
  power:    "PWR",
  contact:  "CON",
  glove:    "GLV",
  speed:    "SPD",
  velocity: "VEL",
  control:  "CTL",
  break:    "BRK",
  xpBonus:  "XP",
};

const STAT_LABEL: Record<string, string> = {
  power:    "Power",
  contact:  "Contact",
  glove:    "Glove",
  speed:    "Speed",
  velocity: "Velocity",
  control:  "Control",
  break:    "Break",
  xpBonus:  "XP Bonus",
};

interface ItemCardProps {
  item: Item;
  onEquip?: () => void;
  onSell?: () => void;
  comparison?: {
    better: string[];
    worse: string[];
    same: string[];
  };
  isEquipped?: boolean;
  compact?: boolean;
}

export function ItemCard({
  item,
  onEquip,
  onSell,
  comparison,
  isEquipped,
  compact = false,
}: ItemCardProps) {
  const rarityColor = getRarityColor(item.rarity);
  const rarityName = RARITY_CONFIG[item.rarity].name;

  const stats = Object.entries(item.stats).filter(
    (entry): entry is [string, number] => entry[1] !== undefined
  );

  if (compact) {
    return (
      <Card
        className={`relative cursor-pointer transition-colors hover:brightness-105 ${
          isEquipped ? "ring-2 ring-yellow-500" : ""
        }`}
      >
        <div className={`absolute inset-0 bg-linear-to-br from-transparent ${RARITY_GLOW[item.rarity]} to-transparent pointer-events-none`} />

        <div className="relative p-2 space-y-1.5">
          {/* Name + Level */}
          <div className="flex items-start justify-between gap-1 min-w-0">
            <div className="flex items-start gap-1 min-w-0 flex-1">
              {item.rarity === "legendary" && (
                <Sparkles className="w-2.5 h-2.5 shrink-0 mt-0.5 animate-pulse" />
              )}
              <span className={`text-xs font-bold leading-tight ${rarityColor} truncate`}>
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5 text-xs text-muted-foreground">
              {(() => { const Icon = SLOT_ICONS[item.slot]; return <Icon className="w-3.5 h-3.5" />; })()}
              <span>Lv{item.itemLevel}</span>
            </div>
          </div>

          {/* Stats — label above, big value below */}
          {stats.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              {stats.map(([stat, value]) => {
                const isBetter = comparison?.better.some(s => s.includes(stat));
                const isWorse  = comparison?.worse.some(s => s.includes(stat));
                const suffix   = stat === "xpBonus" ? "%" : "";
                return (
                  <div key={stat} className="flex flex-col items-center leading-none">
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
                      {STAT_ABBR[stat] ?? stat.slice(0, 3).toUpperCase()}
                    </span>
                    <span className={`text-sm font-bold font-mono flex items-center gap-0.5 ${isWorse ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                      +{value}{suffix}
                      {isBetter && <TrendingUp className="w-3 h-3 shrink-0" />}
                      {isWorse  && <TrendingDown className="w-3 h-3 shrink-0" />}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          {(onEquip || onSell) && (
            <div className="flex gap-1.5">
              {onEquip && (
                <button
                  onClick={onEquip}
                  className="flex-1 px-1.5 py-0.5 text-[9px] font-bold bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  {isEquipped ? "Unequip" : "Equip"}
                </button>
              )}
              {onSell && (
                <button
                  onClick={onSell}
                  className="px-1.5 py-0.5 text-[9px] font-bold bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors whitespace-nowrap"
                >
                  ${item.sellValue}
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Full (non-compact) layout
  return (
    <Card className={`relative ${isEquipped ? "ring-2 ring-yellow-500" : ""}`}>
      <div className={`absolute inset-0 bg-linear-to-br from-transparent ${RARITY_GLOW[item.rarity]} to-transparent pointer-events-none`} />

      <div className="relative p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-bold text-sm leading-tight ${rarityColor} flex items-center gap-1`}>
              {item.rarity === "legendary" && (
                <Sparkles className="w-3 h-3 shrink-0 animate-pulse" />
              )}
              <span>{item.name}</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              {(() => { const Icon = SLOT_ICONS[item.slot]; return <Icon className="w-3 h-3" />; })()}
              <span>{EQUIPMENT_SLOT_NAMES[item.slot]}</span>
              <span>·</span>
              <span>Lvl {item.itemLevel}</span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={`text-xs font-bold ${rarityColor}`}>{rarityName}</span>
            {isEquipped && <Badge variant="default" className="text-xs">Equipped</Badge>}
          </div>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="space-y-1 text-xs">
            {stats.map(([stat, value]) => {
              const isBetter = comparison?.better.some(s => s.includes(stat));
              const isWorse  = comparison?.worse.some(s => s.includes(stat));
              const suffix   = stat === "xpBonus" ? "%" : "";
              return (
                <div key={stat} className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">{STAT_LABEL[stat] ?? stat}</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono ${isWorse ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                      +{value}{suffix}
                    </span>
                    {isBetter && <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />}
                    {isWorse  && <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Flavor text */}
        {item.flavorText && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground italic">{item.flavorText}</p>
          </div>
        )}

        {/* Actions */}
        {(onEquip || onSell) && (
          <div className="flex gap-2">
            {onEquip && (
              <button
                onClick={onEquip}
                className="flex-1 px-2 py-1 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                {isEquipped ? "Unequip" : "Equip"}
              </button>
            )}
            {onSell && (
              <button
                onClick={onSell}
                className="px-2 py-1 text-xs font-bold bg-zinc-600 hover:bg-zinc-700 text-white rounded transition-colors whitespace-nowrap"
              >
                ${item.sellValue}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
