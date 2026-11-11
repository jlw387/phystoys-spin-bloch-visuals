import { describe, expect, it } from "vitest";
import { outcomeProbabilities, Vec3 } from "../spin-one/physics";
import { boundaryHeight, classify, direction, inferPreparation, measurementFrame, Outcome, preparedState, sampleShape } from "./geometry";
import { c, mul } from "../shared/complex";
import { State } from "../spin-one/physics";

describe("experimental spin-1 geometry", () => {
  const z: Vec3 = [0, 0, 1];
  const x: Vec3 = [1, 0, 0];

  it("cross boundaries have zero-height axis valleys and positive off-axis heights", () => {
    for (const boundary of ["cross", "smooth-cross"] as const) {
      expect(boundaryHeight(0, 0, 1, boundary)).toBe(0);
      expect(boundaryHeight(0.5, 0, 1, boundary)).toBe(0);
      expect(boundaryHeight(0, 0.5, 1, boundary)).toBe(0);
      expect(boundaryHeight(0.5, 0.5, 1, boundary)).toBeGreaterThan(0);
      for (const zero of ["disk", "ring"] as const) {
        for (const prep of [x, [0, 1, 0] as Vec3]) {
          const result = sampleShape(prep, 1, zero, 0.5, z, 1, 20000, boundary);
          expect(result.fractions[1]).toBe(0);
          expect(result.fractions[0]).toBeCloseTo(0.5, 2);
        }
        const diagonal = sampleShape(direction(Math.PI / 2, Math.PI / 4), 1, zero, 0.5, z, 1, 20000, boundary);
        expect(diagonal.fractions[1]).toBeGreaterThan(0.02);
        expect(diagonal.fractions.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
      }
    }
  });

  it("uses the same transverse frame for tilted measurement cuts", () => {
    for (const axis of [z, x, direction(1.2, 2.3), [0, 0, -1] as Vec3]) {
      const frame = measurementFrame(axis);
      for (const boundary of ["paraboloid", "cross", "smooth-cross"] as const) {
        const height = boundaryHeight(0.3, 0.4, 0.7, boundary);
        for (const sign of [-1, 1]) {
          const p: Vec3 = [
            0.3 * frame.x.x + 0.4 * frame.y.x + sign * (height + 0.01) * axis[0],
            0.3 * frame.x.y + 0.4 * frame.y.y + sign * (height + 0.01) * axis[1],
            0.3 * frame.x.z + 0.4 * frame.y.z + sign * (height + 0.01) * axis[2],
          ];
          expect(classify(p, axis, 0.7, boundary)).toBe(sign > 0 ? 0 : 2);
        }
      }
    }
  });

  it("automatically finds non-z eigenstate shapes, including arbitrary rotations and global phase", () => {
    for (const [theta, phi] of [[Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [1.2345, 2.3456]]) {
      for (const m of [0, 1, 2] as Outcome[]) {
        const psi = preparedState(theta, phi, m).map((v) => mul(v, c(0, 1))) as State;
        const inferred = inferPreparation(psi, z)!;
        expect(inferred).not.toBeNull();
        expect(outcomeProbabilities(psi, inferred.axis)[inferred.outcome]).toBeCloseTo(1, 10);
        const { samples } = sampleShape(inferred.axis, inferred.outcome, "disk", 0.5, z, 0.5, 100);
        expect(samples).toHaveLength(100);
      }
    }
  });

  it("preserves the previous axis and minus sign when already consistent", () => {
    const psi = preparedState(1.2, 2.3, 2);
    const axis = direction(1.2, 2.3);
    expect(inferPreparation(psi, axis)).toEqual({ axis, outcome: 2 });
  });

  it("does not invent a sphere or disk for a general superposition", () => {
    expect(inferPreparation([c(Math.SQRT1_2), c(0, Math.SQRT1_2), c(0)], z)).toBeNull();
  });

  it("prepares the requested eigenstates along arbitrary axes", () => {
    for (const [theta, phi] of [[0, 0], [1.2, 2.3], [Math.PI, 0], [Math.PI / 2, Math.PI / 2]]) {
      for (const m of [0, 1, 2] as Outcome[]) {
        const probs = outcomeProbabilities(preparedState(theta, phi, m), direction(theta, phi));
        probs.forEach((p, i) => expect(p).toBeCloseTo(i === m ? 1 : 0, 10));
      }
    }
  });

  it("classifies representative points and the origin", () => {
    expect(classify([0, 0, 1], z, 0.5)).toBe(0);
    expect(classify([0, 0, -1], z, 0.5)).toBe(2);
    expect(classify([1, 0, 0], z, 0.5)).toBe(1);
    expect(classify([0, 0, 0], z, 0.5)).toBe(1);
  });

  it("samples sphere surfaces rather than their volumes and conserves probability", () => {
    for (const m of [0, 2] as Outcome[]) {
      const { samples, fractions } = sampleShape(z, m, "disk", 0.5, x, 0.5);
      expect(fractions.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
      const center = m === 0 ? 0.5 : -0.5;
      for (const { position: [px, py, pz] } of samples) {
        expect(Math.hypot(px, py, pz - center)).toBeCloseTo(0.5, 12);
      }
      expect(fractions[1]).toBeGreaterThan(0);
    }
  });

  it("gets unit middle probability for a disk or ring measured along its normal", () => {
    for (const zero of ["disk", "ring"] as const) {
      expect(sampleShape(z, 1, zero, 0.5, z, 0.5).fractions).toEqual([0, 1, 0]);
    }
  });

  it("exposes the nonzero middle probability in the perpendicular disk/ring case", () => {
    for (const zero of ["disk", "ring"] as const) {
      const { fractions } = sampleShape(z, 1, zero, 0.5, x, 0.5);
      expect(fractions[1]).toBeGreaterThan(0.05);
      expect(Math.abs(fractions[0] - fractions[2])).toBeLessThan(0.002);
      expect(outcomeProbabilities(preparedState(0, 0, 1), x)[1]).toBeCloseTo(0, 12);
    }
  });

  it("matches the analytic perpendicular ring fraction", () => {
    const k = 0.8;
    const r = 0.7;
    const threshold = 2 * k * r / (1 + Math.sqrt(1 + 4 * k * k * r * r));
    const expected = 2 * Math.asin(threshold) / Math.PI;
    expect(sampleShape(z, 1, "ring", r, x, k).fractions[1]).toBeCloseTo(expected, 3);
  });

  it("is rotationally covariant with a tilted preparation axis", () => {
    const s = direction(1.1, 0.7);
    for (const m of [0, 1, 2] as Outcome[]) {
      const original = sampleShape(z, m, "disk", 0.5, z, 0.5).fractions;
      const rotated = sampleShape(s, m, "disk", 0.5, s, 0.5).fractions;
      rotated.forEach((p, i) => expect(p).toBeCloseTo(original[i], 10));
    }
  });
});
