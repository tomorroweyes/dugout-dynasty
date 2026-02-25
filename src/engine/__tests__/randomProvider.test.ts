import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RandomProvider,
  MathRandomProvider,
  SeededRandomProvider,
  MockRandomProvider,
  setDefaultRandomProvider,
  getDefaultRandomProvider,
  resetDefaultRandomProvider,
} from "../randomProvider";

describe("randomProvider", () => {
  describe("MathRandomProvider", () => {
    let provider: MathRandomProvider;

    beforeEach(() => {
      provider = new MathRandomProvider();
    });

    it("should return values between 0 and 1", () => {
      for (let i = 0; i < 100; i++) {
        const value = provider.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("should return different values on subsequent calls", () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(provider.random());
      }
      // Should have many unique values
      expect(values.size).toBeGreaterThan(90);
    });

    it("should generate integers in correct range", () => {
      for (let i = 0; i < 100; i++) {
        const value = provider.randomInt(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThan(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("should generate inclusive integers in correct range", () => {
      for (let i = 0; i < 100; i++) {
        const value = provider.randomIntInclusive(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("should eventually generate boundary values for inclusive range", () => {
      const values = new Set();
      for (let i = 0; i < 1000; i++) {
        values.add(provider.randomIntInclusive(1, 3));
      }
      // Should hit all values 1, 2, 3
      expect(values.has(1)).toBe(true);
      expect(values.has(2)).toBe(true);
      expect(values.has(3)).toBe(true);
    });
  });

  describe("SeededRandomProvider", () => {
    it("should generate deterministic sequence with same seed", () => {
      const provider1 = new SeededRandomProvider(12345);
      const provider2 = new SeededRandomProvider(12345);

      const sequence1 = Array.from({ length: 10 }, () => provider1.random());
      const sequence2 = Array.from({ length: 10 }, () => provider2.random());

      expect(sequence1).toEqual(sequence2);
    });

    it("should generate different sequences with different seeds", () => {
      const provider1 = new SeededRandomProvider(12345);
      const provider2 = new SeededRandomProvider(54321);

      const sequence1 = Array.from({ length: 10 }, () => provider1.random());
      const sequence2 = Array.from({ length: 10 }, () => provider2.random());

      expect(sequence1).not.toEqual(sequence2);
    });

    it("should return values between 0 and 1", () => {
      const provider = new SeededRandomProvider(12345);

      for (let i = 0; i < 100; i++) {
        const value = provider.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("should reset to same sequence when seed is reset", () => {
      const provider = new SeededRandomProvider(12345);

      const sequence1 = Array.from({ length: 10 }, () => provider.random());

      provider.setSeed(12345);

      const sequence2 = Array.from({ length: 10 }, () => provider.random());

      expect(sequence1).toEqual(sequence2);
    });

    it("should return current seed", () => {
      const initialSeed = 12345;
      const provider = new SeededRandomProvider(initialSeed);

      // Seed changes after each call
      expect(typeof provider.getSeed()).toBe("number");
    });

    it("should generate deterministic integers", () => {
      const provider1 = new SeededRandomProvider(42);
      const provider2 = new SeededRandomProvider(42);

      const ints1 = Array.from({ length: 10 }, () =>
        provider1.randomInt(1, 100)
      );
      const ints2 = Array.from({ length: 10 }, () =>
        provider2.randomInt(1, 100)
      );

      expect(ints1).toEqual(ints2);
    });

    it("should generate integers in correct range", () => {
      const provider = new SeededRandomProvider(12345);

      for (let i = 0; i < 100; i++) {
        const value = provider.randomInt(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThan(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("should generate inclusive integers in correct range", () => {
      const provider = new SeededRandomProvider(12345);

      for (let i = 0; i < 100; i++) {
        const value = provider.randomIntInclusive(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("should handle seed value of 0", () => {
      const provider = new SeededRandomProvider(0);
      const value = provider.random();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it("should produce good distribution", () => {
      const provider = new SeededRandomProvider(12345);
      const buckets = Array(10).fill(0);

      for (let i = 0; i < 10000; i++) {
        const value = provider.random();
        const bucket = Math.floor(value * 10);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 1000 values (±20%)
      for (const count of buckets) {
        expect(count).toBeGreaterThan(800);
        expect(count).toBeLessThan(1200);
      }
    });
  });

  describe("MockRandomProvider", () => {
    it("should return predetermined values in sequence", () => {
      const values = [0.1, 0.5, 0.9];
      const provider = new MockRandomProvider(values);

      expect(provider.random()).toBe(0.1);
      expect(provider.random()).toBe(0.5);
      expect(provider.random()).toBe(0.9);
    });

    it("should cycle through values", () => {
      const values = [0.1, 0.5];
      const provider = new MockRandomProvider(values);

      expect(provider.random()).toBe(0.1);
      expect(provider.random()).toBe(0.5);
      expect(provider.random()).toBe(0.1); // Cycles back
      expect(provider.random()).toBe(0.5);
    });

    it("should reset to beginning of sequence", () => {
      const values = [0.1, 0.5, 0.9];
      const provider = new MockRandomProvider(values);

      provider.random();
      provider.random();
      provider.reset();

      expect(provider.random()).toBe(0.1);
    });

    it("should track call count", () => {
      const values = [0.1, 0.5, 0.9];
      const provider = new MockRandomProvider(values);

      expect(provider.getCallCount()).toBe(0);
      provider.random();
      expect(provider.getCallCount()).toBe(1);
      provider.random();
      expect(provider.getCallCount()).toBe(2);

      provider.reset();
      expect(provider.getCallCount()).toBe(0);
    });

    it("should throw error with empty values array", () => {
      expect(() => new MockRandomProvider([])).toThrow();
    });

    it("should handle single value", () => {
      const provider = new MockRandomProvider([0.7]);

      expect(provider.random()).toBe(0.7);
      expect(provider.random()).toBe(0.7);
      expect(provider.random()).toBe(0.7);
    });

    it("should generate integers based on mock values", () => {
      // 0.5 * (20 - 10) + 10 = 15
      const provider = new MockRandomProvider([0.5]);

      const value = provider.randomInt(10, 20);
      expect(value).toBe(15);
    });

    it("should generate inclusive integers based on mock values", () => {
      // For range 10-20 (11 values), 0.5 * 11 + 10 = 15
      const provider = new MockRandomProvider([0.5]);

      const value = provider.randomIntInclusive(10, 20);
      expect(value).toBe(15);
    });

    it("should be useful for testing specific scenarios", () => {
      // Test strikeout scenario (low roll)
      const strikeoutProvider = new MockRandomProvider([0.05]);
      expect(strikeoutProvider.random() * 100).toBe(5);

      // Test homerun scenario (high roll)
      const homerunProvider = new MockRandomProvider([0.95]);
      expect(homerunProvider.random() * 100).toBe(95);
    });
  });

  describe("global default provider", () => {
    afterEach(() => {
      resetDefaultRandomProvider();
    });

    it("should return MathRandomProvider by default", () => {
      const provider = getDefaultRandomProvider();
      expect(provider).toBeInstanceOf(MathRandomProvider);
    });

    it("should allow setting custom provider", () => {
      const mockProvider = new MockRandomProvider([0.5]);
      setDefaultRandomProvider(mockProvider);

      const provider = getDefaultRandomProvider();
      expect(provider).toBe(mockProvider);
    });

    it("should reset to MathRandomProvider", () => {
      const mockProvider = new MockRandomProvider([0.5]);
      setDefaultRandomProvider(mockProvider);

      resetDefaultRandomProvider();

      const provider = getDefaultRandomProvider();
      expect(provider).toBeInstanceOf(MathRandomProvider);
    });

    it("should affect functions using default provider", () => {
      const mockProvider = new MockRandomProvider([0.5]);
      setDefaultRandomProvider(mockProvider);

      const provider = getDefaultRandomProvider();
      expect(provider.random()).toBe(0.5);
    });
  });

  describe("RandomProvider interface compliance", () => {
    const providers: [string, () => RandomProvider][] = [
      ["MathRandomProvider", () => new MathRandomProvider()],
      ["SeededRandomProvider", () => new SeededRandomProvider(12345)],
      ["MockRandomProvider", () => new MockRandomProvider([0.5])],
    ];

    providers.forEach(([name, createProvider]) => {
      describe(name, () => {
        let provider: RandomProvider;

        beforeEach(() => {
          provider = createProvider();
        });

        it("should implement random()", () => {
          const value = provider.random();
          expect(typeof value).toBe("number");
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        });

        it("should implement randomInt()", () => {
          const value = provider.randomInt(1, 10);
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThan(10);
        });

        it("should implement randomIntInclusive()", () => {
          const value = provider.randomIntInclusive(1, 10);
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(10);
        });
      });
    });
  });
});
