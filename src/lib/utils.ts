import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getStatColor as getStatColorFromConfig } from "@/engine/statConfig";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get color class based on stat value (0-100 scale)
 * Now uses centralized stat configuration for consistency
 * @deprecated Import directly from @/engine/statConfig for new code
 */
export function getStatColor(value: number): string {
  return getStatColorFromConfig(value);
}
