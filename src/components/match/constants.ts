export type SimMode = "end" | "half" | "inning" | "runners" | "gamePlan";

export const SIM_MODE_LABELS: Record<SimMode, string> = {
  end: "Sim to End",
  half: "Sim Half",
  inning: "Sim Inning",
  runners: "Sim until Runners",
  gamePlan: "Auto (Game Plan)",
};

/** Ball-landing positions per outcome (SVG coords in 240x240 viewBox) */
export const FIELD_POSITIONS: Record<string, { x: number; y: number }[]> = {
  // Outs — diamond half-diag=57, bases at (63,143)/(120,86)/(177,143)
  groundout: [
    { x: 85, y: 122 }, // shortstop
    { x: 155, y: 122 }, // 2nd baseman
    { x: 172, y: 148 }, // 1st baseman
    { x: 68, y: 148 }, // 3rd baseman
    { x: 120, y: 147 }, // pitcher
  ],
  flyout: [
    { x: 55, y: 60 }, // left field
    { x: 120, y: 40 }, // center field
    { x: 185, y: 60 }, // right field
  ],
  lineout: [
    { x: 85, y: 118 }, // shortstop
    { x: 155, y: 118 }, // 2nd baseman
    { x: 60, y: 65 }, // left field
    { x: 120, y: 50 }, // center field
    { x: 180, y: 65 }, // right field
  ],
  popout: [
    { x: 120, y: 180 }, // catcher
    { x: 93, y: 143 }, // shortstop shallow
    { x: 147, y: 143 }, // 2nd baseman shallow
    { x: 70, y: 155 }, // 3rd baseman
    { x: 170, y: 155 }, // 1st baseman
  ],
  // Hits
  single: [
    { x: 55, y: 65 }, // through hole to left
    { x: 120, y: 60 }, // up the middle
    { x: 185, y: 65 }, // through hole to right
    { x: 75, y: 75 }, // past shortstop
    { x: 165, y: 75 }, // past 2nd baseman
  ],
  double: [
    { x: 30, y: 38 }, // left field line
    { x: 75, y: 22 }, // left-center gap
    { x: 165, y: 22 }, // right-center gap
    { x: 210, y: 38 }, // right field line
  ],
  triple: [
    { x: 22, y: 42 }, // deep left corner (inside fence)
    { x: 218, y: 42 }, // deep right corner (inside fence)
    { x: 120, y: 18 }, // deep center (inside fence)
  ],
  homerun: [
    { x: 10, y: 12 }, // left field stands
    { x: 65, y: -2 }, // left-center stands
    { x: 120, y: -10 }, // center field stands
    { x: 175, y: -2 }, // right-center stands
    { x: 230, y: 12 }, // right field stands
  ],
};

export const OUT_TYPES = new Set(["groundout", "flyout", "lineout", "popout"]);
export const HIT_TYPES = new Set(["single", "double", "triple", "homerun"]);
export const TEXT_MARKERS: Record<string, { text: string; color: string }> = {
  strikeout: { text: "K", color: "#ef4444" },
  walk: { text: "BB", color: "#60a5fa" },
};

export const HIT_COLORS: Record<string, string> = {
  single: "#4ade80", // green
  double: "#facc15", // yellow
  triple: "#fb923c", // orange
  homerun: "#c084fc", // purple
};
