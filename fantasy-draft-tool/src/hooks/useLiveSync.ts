import { useEffect, useState } from "react";
import { loadEspnLeagueDataFresh } from "../lib/data";
import type { EspnLeagueData } from "../types";

export function useLiveSync(
  setEspnData: (data: EspnLeagueData) => void,
  setCurrentPick: (updater: (prev: number | null) => number | null) => void,
) {
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(false);
  const [liveSyncStatus, setLiveSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [liveSyncLastAt, setLiveSyncLastAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!liveSyncEnabled) return;

    let cancelled = false;

    async function sync() {
      setLiveSyncStatus("syncing");
      try {
        const fresh = await loadEspnLeagueDataFresh();
        if (cancelled) return;
        setEspnData(fresh);
        const pickCount = fresh.draftPicks.filter((p) => p.playerId > 0).length;
        setCurrentPick((prev) => {
          const espnNext = pickCount + 1;
          return prev == null || espnNext > prev ? espnNext : prev;
        });
        setLiveSyncLastAt(new Date());
        setLiveSyncStatus("idle");
      } catch {
        if (!cancelled) setLiveSyncStatus("error");
      }
    }

    sync();
    const interval = setInterval(sync, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [liveSyncEnabled, setEspnData, setCurrentPick]);

  return { liveSyncEnabled, setLiveSyncEnabled, liveSyncStatus, liveSyncLastAt };
}
