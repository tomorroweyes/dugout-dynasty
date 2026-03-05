import { useEffect, useState } from "react";
import type { BreakthroughEvent } from "@/types/breakthroughs";

const SKILL_NAMES: Record<string, string> = {
  ice_veins: "Ice Veins",
  pitch_recognition: "Pitch Recognition",
  clutch_composure: "Clutch Composure",
  veteran_poise: "Veteran's Poise",
  game_reading: "Game Reading",
};

const SKILL_ICONS: Record<string, string> = {
  ice_veins: "🧊",
  pitch_recognition: "👁️",
  clutch_composure: "❤️",
  veteran_poise: "🎖️",
  game_reading: "🧠",
};

/** Duration in ms that the screen remains visible before fading out. */
const VISIBLE_DURATION_MS = 1800;
/** Total lifetime of the screen including the fade animation. */
const TOTAL_DURATION_MS = 2100;

interface BreakthroughScreenProps {
  /** The breakthrough event to display. */
  event: BreakthroughEvent;
  /** The player's full display name. */
  playerName: string;
  /** Called when the screen has fully exited (either by timer or user click). */
  onExited: () => void;
}

/**
 * Full-screen celebratory overlay that displays when a player achieves a
 * breakthrough moment. Auto-dismisses after ~2 seconds and is skippable by
 * clicking anywhere.
 */
export function BreakthroughScreen({
  event,
  playerName,
  onExited,
}: BreakthroughScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in on the next frame so the transition fires
    const showTimer = setTimeout(() => setVisible(true), 10);
    // Begin fade-out before full duration so exit feels smooth
    const fadeTimer = setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
    // Unmount after fade completes
    const exitTimer = setTimeout(onExited, TOTAL_DURATION_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
      clearTimeout(exitTimer);
    };
  }, [onExited]);

  const handleClick = () => {
    setVisible(false);
    // Small delay so fade plays before unmount
    setTimeout(onExited, 300);
  };

  const skillName = SKILL_NAMES[event.skillId] || event.skillId;
  const skillIcon = SKILL_ICONS[event.skillId] || "✨";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center cursor-pointer select-none transition-opacity duration-300 bg-black/90 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClick}
      data-testid="breakthrough-screen"
    >
      <div
        className={`text-center px-8 max-w-2xl transition-transform duration-200 ${visible ? "scale-100" : "scale-90"}`}
      >
        {/* Header badge */}
        <div className="text-amber-400 font-bold font-mono text-sm tracking-widest mb-3 uppercase">
          ✨ Breakthrough Moment ✨
        </div>

        {/* Player name */}
        <div className="text-white font-bold text-4xl sm:text-5xl mb-2">
          {playerName}
        </div>

        {/* Skill name + icon */}
        <div className="flex items-center justify-center gap-2 text-purple-300 font-mono text-xl mb-5">
          <span>{skillIcon}</span>
          <span>{skillName}</span>
          <span className="text-purple-400/60 text-sm">
            Rank {event.skillRank}
          </span>
        </div>

        {/* Narrative text */}
        <div className="text-white/80 text-base sm:text-lg leading-relaxed whitespace-pre-line max-w-lg mx-auto mb-4">
          {event.narrative}
        </div>

        {/* Mentor quote (optional) */}
        {event.mentorNarrative && (
          <div className="text-white/50 text-sm italic mt-2 max-w-md mx-auto">
            {event.mentorNarrative}
          </div>
        )}

        {/* Memory label */}
        <div className="mt-5 text-xs text-white/30 font-mono">
          {event.memoryLabel}
        </div>

        {/* Dismiss hint */}
        <div className="mt-4 text-xs text-white/20">click to skip</div>
      </div>
    </div>
  );
}
