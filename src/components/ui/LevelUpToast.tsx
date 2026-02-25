import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { LevelUpResult } from "@/engine/xpSystem";

interface LevelUpToastProps {
  levelUp: LevelUpResult;
  onDismiss: () => void;
}

function LevelUpToastItem({ levelUp, onDismiss }: LevelUpToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
        bg-gradient-to-r from-amber-500 to-yellow-400
        text-white px-4 py-3 rounded-lg shadow-lg
        border-2 border-amber-300
      `}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">⭐</div>
        <div>
          <div className="font-bold text-lg">LEVEL UP!</div>
          <div className="text-sm">
            {levelUp.playerName} reached Level {levelUp.newLevel}!
          </div>
          <div className="text-xs mt-1 opacity-90">
            {levelUp.statBonuses.map((bonus) => (
              <span key={bonus.stat} className="mr-2">
                +{bonus.increase.toFixed(1)} {bonus.stat.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LevelUpToastContainer() {
  const pendingLevelUps = useGameStore((state) => state.pendingLevelUps);
  const clearPendingLevelUps = useGameStore((state) => state.clearPendingLevelUps);
  const [displayedLevelUps, setDisplayedLevelUps] = useState<LevelUpResult[]>([]);

  useEffect(() => {
    if (pendingLevelUps.length > 0) {
      setDisplayedLevelUps(pendingLevelUps);
      clearPendingLevelUps();
    }
  }, [pendingLevelUps, clearPendingLevelUps]);

  const handleDismiss = (playerId: string, newLevel: number) => {
    setDisplayedLevelUps((prev) =>
      prev.filter((lu) => !(lu.playerId === playerId && lu.newLevel === newLevel))
    );
  };

  if (displayedLevelUps.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {displayedLevelUps.map((levelUp) => (
        <LevelUpToastItem
          key={`${levelUp.playerId}-${levelUp.newLevel}`}
          levelUp={levelUp}
          onDismiss={() => handleDismiss(levelUp.playerId, levelUp.newLevel)}
        />
      ))}
    </div>
  );
}
