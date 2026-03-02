// Re-export from parent randomProvider to avoid module-not-found error
export type { RandomProvider } from "../randomProvider";
export { MathRandomProvider, getDefaultRandomProvider, SeededRandomProvider } from "../randomProvider";
