import { describe, expect, it } from "vitest";
import { majoranaStars, normalize, Vec3 } from "../spin-one/physics";
import { parseComplex } from "../shared/complex";
import { sphereOverlap } from "./overlap";

describe("spatial Majorana sphere overlap", () => {
  const z: Vec3 = [0, 0, 1];
  it("handles identical and tangent spheres", () => {
    expect(sphereOverlap(z, z)).toMatchObject({ distance: 0, volumeFraction: 1, surfaceFraction: 1, quantumOverlapSquared: 1 });
    expect(sphereOverlap(z, [0, 0, -1])).toMatchObject({ distance: 1, volumeFraction: 0, surfaceFraction: 0, quantumOverlapSquared: 0 });
  });
  it("decreases continuously with separation and distinguishes volume from quantum overlap", () => {
    let previous = 1;
    for (let degree = 0; degree <= 180; degree++) {
      const theta = degree * Math.PI / 180;
      const overlap = sphereOverlap(z, [Math.sin(theta), 0, Math.cos(theta)]);
      expect(overlap.volumeFraction).toBeLessThanOrEqual(previous + 1e-12);
      expect(overlap.quantumOverlapSquared).toBeCloseTo(Math.cos(theta / 2) ** 2, 12);
      previous = overlap.volumeFraction;
    }
    expect(sphereOverlap(z, [1, 0, 0]).volumeFraction).not.toBeCloseTo(0.5, 2);
  });
  it("rim disk lies on both sphere surfaces and its area fraction equals the quantum overlap", () => {
    for (let degree = 1; degree < 180; degree += 7) {
      const t = degree * Math.PI / 180;
      const a: Vec3 = [0.3, -0.4, Math.sqrt(0.75)];
      const b: Vec3 = [Math.sin(t) * 0.6, Math.cos(t), Math.sin(t) * 0.8];
      const nb = Math.hypot(...b);
      const bn = b.map((v) => v / nb) as Vec3;
      const overlap = sphereOverlap(a, bn);
      const dotAB = a[0] * bn[0] + a[1] * bn[1] + a[2] * bn[2];
      expect(overlap.rimDiskFraction).toBeCloseTo((1 + dotAB) / 2, 12);
      // The rim circle's diametric endpoints are the origin and the midpoint of the star tips.
      for (const p of [[0, 0, 0], a.map((v, i) => (v + bn[i]) / 2)]) {
        for (const star of [a, bn]) {
          const r = Math.hypot(p[0] - star[0] / 2, p[1] - star[1] / 2, p[2] - star[2] / 2);
          expect(r).toBeCloseTo(0.5, 12);
        }
      }
      const tipMidpoint = a.map((v, i) => (v + bn[i]) / 2);
      expect(Math.hypot(...tipMidpoint) / 2).toBeCloseTo(overlap.rimRadius, 12);
    }
  });
  it("presets produce their advertised star separations", () => {
    const cases: [string, string, string, number][] = [
      ["sqrt(6)", "1", "0", 60],
      ["sqrt(2)", "1", "0", 90],
      ["sqrt(2)", "sqrt(3)", "0", 120],
      ["1", "2*sqrt(2)*i", "-1", 120],
      ["1", "-sqrt(6)*i", "1", 180],
    ];
    for (const [a, b, c, separation] of cases) {
      const state = normalize([parseComplex(a), parseComplex(b), parseComplex(c)])!.state;
      expect(sphereOverlap(...majoranaStars(state)).separation * 180 / Math.PI).toBeCloseTo(separation, 5);
    }
  });
});
