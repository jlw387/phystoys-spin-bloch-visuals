import { describe, expect, it } from "vitest";
import { Vec3 } from "../spin-one/physics";
import { excludedBySweep, horizontalWitness, inMiddleRegion } from "./sweep";

describe("horizontal paraboloid sweep", () => {
  it("leaves diagonal candidates after x/y exclusions but not after the full sweep", () => {
    for (const x of [-0.3, 0.3]) {
      for (const y of [-0.3, 0.3]) {
        const p: Vec3 = [x, y, 0];
        expect(inMiddleRegion(p, [0, 0, 1])).toBe(true);
        expect(excludedBySweep(p, 2)).toBe(false);
        expect(excludedBySweep(p, 4)).toBe(true);
        expect(excludedBySweep(p, null)).toBe(true);
      }
    }
  });

  it("constructs an excluding horizontal axis for every point, including poles and origin", () => {
    const points: Vec3[] = [[0, 0, 0], [0, 0, 1], [1, 0, 0], [0, -1, 0], [0.2, -0.5, 0.3], [3, 7, -9], [1e-4, 2e-4, 0]];
    for (const p of points) {
      const n = horizontalWitness(p);
      expect(n[2]).toBe(0);
      expect(Math.hypot(...n)).toBeCloseTo(1, 12);
      expect(p[0] * n[0] + p[1] * n[1]).toBeCloseTo(0, 12);
      expect(inMiddleRegion(p, n)).toBe(true);
      expect(excludedBySweep(p, null)).toBe(true);
    }
  });

  it("can retain arbitrarily near-origin points for finite axes", () => {
    const phi = Math.PI / 64;
    const p: Vec3 = [1e-3 * Math.cos(phi), 1e-3 * Math.sin(phi), 0];
    expect(excludedBySweep(p, 32)).toBe(false);
    expect(excludedBySweep(p, null)).toBe(true);
  });
});
