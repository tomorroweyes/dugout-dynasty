/**
 * Random Provider Interface
 * Allows dependency injection of randomness for testability
 */

export interface RandomProvider {
  /**
   * Returns a random number between 0 (inclusive) and 1 (exclusive)
   */
  random(): number;

  /**
   * Returns a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number;

  /**
   * Returns a random integer between min (inclusive) and max (inclusive)
   */
  randomIntInclusive(min: number, max: number): number;
}

/**
 * Default implementation using Math.random()
 */
export class MathRandomProvider implements RandomProvider {
  random(): number {
    return Math.random();
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  randomIntInclusive(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

/**
 * Seeded implementation using Linear Congruential Generator
 * Useful for deterministic testing and replay
 */
export class SeededRandomProvider implements RandomProvider {
  private seed: number;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  constructor(seed: number = Date.now()) {
    // Hash the seed to avoid correlation issues with sequential seeds
    // Uses a simple but effective hash function
    seed = seed >>> 0; // Ensure 32-bit unsigned integer
    seed = (seed ^ (seed >>> 16)) * 0x85ebca6b;
    seed = (seed ^ (seed >>> 13)) * 0xc2b2ae35;
    seed = seed ^ (seed >>> 16);
    this.seed = seed >>> 0;
  }

  random(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  randomIntInclusive(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  getSeed(): number {
    return this.seed;
  }

  setSeed(seed: number): void {
    // Apply the same hash when setting seed
    seed = seed >>> 0;
    seed = (seed ^ (seed >>> 16)) * 0x85ebca6b;
    seed = (seed ^ (seed >>> 13)) * 0xc2b2ae35;
    seed = seed ^ (seed >>> 16);
    this.seed = seed >>> 0;
  }
}

/**
 * Mock implementation that returns fixed values
 * Perfect for unit testing specific scenarios
 */
export class MockRandomProvider implements RandomProvider {
  private values: number[];
  private index: number = 0;

  /**
   * Create a mock provider with predetermined values
   * @param values - Array of values to return in sequence (will cycle)
   */
  constructor(values: number[]) {
    if (values.length === 0) {
      throw new Error("MockRandomProvider requires at least one value");
    }
    this.values = values;
  }

  random(): number {
    const value = this.values[this.index % this.values.length];
    this.index++;
    return value;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  randomIntInclusive(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  reset(): void {
    this.index = 0;
  }

  getCallCount(): number {
    return this.index;
  }
}

/**
 * Global default random provider
 * Can be overridden for testing
 */
let defaultProvider: RandomProvider = new MathRandomProvider();

export function setDefaultRandomProvider(provider: RandomProvider): void {
  defaultProvider = provider;
}

export function getDefaultRandomProvider(): RandomProvider {
  return defaultProvider;
}

export function resetDefaultRandomProvider(): void {
  defaultProvider = new MathRandomProvider();
}
