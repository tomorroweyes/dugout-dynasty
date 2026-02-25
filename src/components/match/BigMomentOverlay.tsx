import { useEffect, useState } from "react";

export interface BigMoment {
  tier: "legendary" | "epic" | "notable";
  headline: string;
  narrativeText: string;
  durationMs: number;
}

interface BigMomentOverlayProps {
  moment: BigMoment;
  onExited: () => void;
}

const tierStyles = {
  legendary: {
    overlay: "bg-black/90",
    headline: "text-amber-400",
    size: "text-4xl sm:text-5xl",
  },
  epic: {
    overlay: "bg-black/85",
    headline: "text-purple-400",
    size: "text-3xl sm:text-4xl",
  },
  notable: {
    overlay: "bg-black/70",
    headline: "text-white/90",
    size: "text-2xl sm:text-3xl",
  },
};

export function BigMomentOverlay({ moment, onExited }: BigMomentOverlayProps) {
  const [visible, setVisible] = useState(false);
  const styles = tierStyles[moment.tier];

  useEffect(() => {
    // Animate in on next frame
    const showTimer = setTimeout(() => setVisible(true), 10);
    // Begin fade-out before full duration
    const fadeTimer = setTimeout(() => setVisible(false), moment.durationMs - 300);
    // Unmount after fade completes
    const exitTimer = setTimeout(onExited, moment.durationMs);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(fadeTimer);
      clearTimeout(exitTimer);
    };
  }, [moment.durationMs, onExited]);

  const handleClick = () => {
    setVisible(false);
    // Small delay so fade plays before unmount
    setTimeout(onExited, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center cursor-pointer select-none transition-opacity duration-300 ${styles.overlay} ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClick}
    >
      <div
        className={`text-center px-8 max-w-2xl transition-transform duration-200 ${visible ? "scale-100" : "scale-90"}`}
      >
        <div
          className={`font-bold font-mono tracking-wide mb-4 ${styles.headline} ${styles.size}`}
        >
          {moment.headline}
        </div>
        {moment.narrativeText && (
          <div className="text-white/75 text-base sm:text-lg leading-relaxed whitespace-pre-line max-w-lg mx-auto">
            {moment.narrativeText}
          </div>
        )}
      </div>
    </div>
  );
}
