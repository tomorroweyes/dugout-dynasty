/**
 * Design tokens — single source of truth for colors used in JS/TS contexts.
 *
 * These mirror the @theme vars in index.css exactly. Use these when you need
 * the raw hex value: TIER_COLOR/AVAILABILITY_COLOR maps, computed alpha strings
 * like `${color}18`, or anywhere a CSS variable reference won't work.
 *
 * For className usage prefer the Tailwind utilities (text-accent, bg-surface, …).
 * For inline style solid colors prefer var(--color-xxx).
 */
export const C = {
  // Action / status
  accent:     "#b4f000",
  danger:     "#ff3d3d",
  dangerSoft: "#ff8888",
  warn:       "#ff8800",
  info:       "#00d4ff",
  blue:       "#00aaff",
  blueSoft:   "#88ccff",
  purple:     "#7878b8",

  // Surfaces
  base:    "#0a0a0e",
  surface: "#111118",
  panel:   "#131318",
  raised:  "#141420",
  card:    "#16161e",

  // Text
  body:  "#e0e0e0",
  soft:  "#aaaaaa",
  muted: "#7878a0",
  dim:   "#686878",
  ghost: "#444444",
} as const;

export type ColorToken = keyof typeof C;

/** Tier → accent color (for PlayerCard border, score text, draft button) */
export const TIER_COLOR: Record<string, string> = {
  ELITE: C.danger,
  "1":   C.warn,
  "2":   C.accent,
  "3":   C.info,
  "4":   C.purple,
  "5":   C.dim,
};

/** ESPN availability status → accent color */
export const AVAILABILITY_COLOR: Record<string, string> = {
  now:     C.danger,
  swing:   C.warn,
  fragile: C.accent,
  safe:    C.info,
  unknown: C.dim,
};

/** Need-card tone → color (for IntelPanel need card borders/text) */
export const NEED_TONE_COLOR: Record<string, string> = {
  urgent: C.danger,
  watch:  C.warn,
  stable: C.accent,
};
