/**
 * Seeded Random Number Generator
 * Uses a simple Linear Congruential Generator (LCG) for deterministic randomness
 * This allows game simulations to be replayed with the same seed
 */

export class SeededRandom {
  private seed: number;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seed: number = Date.now()) {
    this.seed = seed >>> 0; // Ensure 32-bit unsigned integer
  }

  /**
   * Generate next random number between 0 (inclusive) and 1 (exclusive)
   */
  next(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate random integer between min (inclusive) and max (inclusive)
   */
  nextIntInclusive(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Get current seed value (for saving/loading state)
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Set seed value (for loading saved state)
   */
  setSeed(seed: number): void {
    this.seed = seed >>> 0;
  }

  /**
   * Generate random boolean with given probability
   * @param probability - Value between 0 and 1 (0.5 = 50% chance)
   */
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Global instance for backward compatibility
 * Can be replaced with custom seed for testing/replay
 */
let globalRng = new SeededRandom();

export const seedGlobalRng = (seed: number): void => {
  globalRng = new SeededRandom(seed);
};

export const getGlobalRng = (): SeededRandom => globalRng;

/**
 * Utility function that mimics Math.random() but uses seeded RNG
 */
export const seededRandom = (): number => globalRng.next();
