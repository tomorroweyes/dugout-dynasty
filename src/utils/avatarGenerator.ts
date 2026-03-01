import { createAvatar } from "@dicebear/core";
import {
  avataaars,
  bigSmile,
  bottts,
  funEmoji,
  pixelArt,
} from "@dicebear/collection";

// Avatar styles available - you can switch between these
const avatarStyles = {
  avataaars, // Cartoon avatars with baseball caps!
  bigSmile, // Cheerful expressive faces
  bottts, // Fun robot characters
  funEmoji, // Emoji-style faces
  pixelArt, // Retro 8-bit style
};

type AvatarStyle = keyof typeof avatarStyles;

export interface AvatarOptions {
  teamColor?: string; // Hex color (e.g., 'ff5c5c' for red) for hat/clothes
  hasHat?: boolean; // Give player a baseball cap (avataaars style only)
  position?: string; // Player position (future use for customization)
}

/**
 * Generate a player avatar SVG data URI from their name
 * @param playerName - The player's name (used as seed for consistent avatars)
 * @param style - The avatar style to use (default: 'avataaars' for baseball caps)
 * @param options - Additional customization options for team colors, hats, etc.
 * @returns Data URI string that can be used directly in img src
 */
export function generatePlayerAvatar(
  playerName: string,
  style: AvatarStyle = "pixelArt",
  options?: AvatarOptions,
): string {
  // Baseball-themed customization for pixelArt style
  // Typed as Record<string, unknown> so the spread is compatible with the avatar library's Partial<Options>
  const baseballOptions: Record<string, unknown> =
    style === "pixelArt"
      ? {
          // variant02 looks like baseball caps!
          hat: ["variant02"],
          hatProbability: options?.hasHat !== false ? 100 : 0,
          // Team colors for the hat and uniform (default to blue)
          hatColor: [options?.teamColor || "5199e4"],
          clothingColor: [options?.teamColor || "5199e4"],
        }
      : style === "avataaars"
        ? {
            clothesColor: [options?.teamColor || "5199e4"],
            accessoriesProbability: 30,
          }
        : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatar = createAvatar(avatarStyles[style] as any, {
    seed: playerName,
    size: 128,
    ...baseballOptions,
  });

  return avatar.toDataUri();
}

/**
 * Get the raw SVG string for a player avatar
 * @param playerName - The player's name (used as seed)
 * @param style - The avatar style to use
 * @param options - Additional customization options for team colors, hats, etc.
 * @returns SVG string
 */
export function generatePlayerAvatarSvg(
  playerName: string,
  style: AvatarStyle = "pixelArt",
  options?: AvatarOptions,
): string {
  // Baseball-themed customization
  // Typed as Record<string, unknown> so the spread is compatible with the avatar library's Partial<Options>
  const baseballOptions: Record<string, unknown> =
    style === "pixelArt"
      ? {
          hat: ["variant02"],
          hatProbability: options?.hasHat !== false ? 100 : 0,
          hatColor: [options?.teamColor || "5199e4"],
          clothingColor: [options?.teamColor || "5199e4"],
        }
      : style === "avataaars"
        ? {
            clothesColor: [options?.teamColor || "5199e4"],
            accessoriesProbability: 30,
          }
        : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatar = createAvatar(avatarStyles[style] as any, {
    seed: playerName,
    size: 128,
    ...baseballOptions,
  });

  return avatar.toString();
}

// Common baseball team colors for easy reference
export const TEAM_COLORS = {
  red: "ff5c5c",
  blue: "5199e4",
  green: "a7ffc4",
  yellow: "ffffb1",
  orange: "ffdeb5",
  purple: "c0aede",
  gray: "929598",
  black: "262e33",
  white: "ffffff",
} as const;

// Export available styles for type safety
export type { AvatarStyle };
export const AVATAR_STYLES = Object.keys(avatarStyles) as AvatarStyle[];
