import { describe, expect, it } from "vitest";
import { mobiusPoint, mobiusToPair, pairOutcome, pairToMobius, torusPoint } from "./geometry";

const strip = (a: number, b: number) => {
  const { u, w } = pairToMobius(a, b);
  return mobiusPoint(u, w);
};
const close = (p: number[], q: number[]) => p.forEach((v, i) => expect(v).toBeCloseTo(q[i], 10));

describe("unordered pairs on a circle form a Möbius strip", () => {
  const samples = Array.from({ length: 40 }, (_, i) => [0.37 * i - 4, 1.91 * i + 0.2]);

  it("maps a pair and its swap to the same strip point, but different torus points", () => {
    for (const [a, b] of samples) {
      close(strip(a, b), strip(b, a));
      if (Math.abs(Math.sin((a - b) / 2)) > 1e-3) {
        const p = torusPoint(a, b);
        const q = torusPoint(b, a);
        expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeGreaterThan(1e-3);
      }
    }
  });

  it("depends only on the points, not on which full turn names their angles", () => {
    for (const [a, b] of samples) {
      close(strip(a, b), strip(a + 2 * Math.PI, b));
      close(strip(a, b), strip(a, b - 6 * Math.PI));
    }
    close(mobiusPoint(0.8 + 2 * Math.PI, -0.3), mobiusPoint(0.8, 0.3));
  });

  it("sends coincident points to the single edge of the strip", () => {
    for (const [a] of samples) expect(Math.abs(pairToMobius(a, a).w)).toBeCloseTo(1, 12);
  });

  it("round-trips strip coordinates and separates nearby strip points", () => {
    for (let i = 0; i < 30; i++) {
      const u = 2 * Math.PI * i / 30;
      for (const w of [-0.9, -0.4, 0.1, 0.7]) {
        const [a, b] = mobiusToPair(u, w);
        close(strip(a, b), mobiusPoint(u, w));
        const here = mobiusPoint(u, w);
        const other = mobiusPoint(u + 0.05, w);
        expect(Math.hypot(here[0] - other[0], here[1] - other[1], here[2] - other[2])).toBeGreaterThan(1e-3);
      }
    }
  });

  it("gives swap-symmetric outcomes, so the two mixed regions merge", () => {
    for (const [a, b] of samples) {
      for (const cut of [0, 0.7, 2.4]) expect(pairOutcome(a, b, cut)).toBe(pairOutcome(b, a, cut));
    }
    expect(pairOutcome(0.2, -0.2, 0)).toBe(1);
    expect(pairOutcome(0.2, Math.PI, 0)).toBe(0);
    expect(pairOutcome(Math.PI - 0.1, Math.PI + 0.1, 0)).toBe(-1);
  });
});
