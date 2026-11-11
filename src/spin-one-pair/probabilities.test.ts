import { describe, expect, it } from "vitest";
import { c } from "../shared/complex";
import { coherent, majoranaStars, normalize, outcomeProbabilities, State, Vec3 } from "../spin-one/physics";
import { pairAmplitudes, pairProbabilities, PrincipalAxis } from "./probabilities";

describe("two Majorana spin-half probabilities", () => {
  const axes: Vec3[] = [[0, 0, 1], [1, 0, 0], [0, 1, 0], [0.6, 0, 0.8]];
  const states: State[] = [
    coherent(0, 0), coherent(1.2, 2.3),
    [c(0), c(1), c(0)],
    [c(1), c(0), c(1)],
    [c(1), c(0, 1), c(0)],
    [c(1, 2), c(3, -1), c(-2, 1)],
  ];
  it("symmetrized pairs reproduce the state-vector Born rule for general states", () => {
    for (const raw of states) {
      const state = normalize(raw)!.state;
      const [a, b] = majoranaStars(state);
      for (const axis of axes) {
        const pair = pairProbabilities(a, b, axis);
        const exact = outcomeProbabilities(state, axis);
        pair.symmetric.forEach((p, i) => expect(p).toBeCloseTo(exact[i], 10));
        expect(pair.independent.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
        expect(pair.symmetric.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
        expect(pairProbabilities(b, a, axis).symmetric).toEqual(pair.symmetric);
      }
    }
  });
  it("independent copies match coherent states at all tested angles", () => {
    for (let degree = 0; degree <= 180; degree++) {
      const angle = degree * Math.PI / 180;
      const p = pairProbabilities([0, 0, 1], [0, 0, 1], [Math.sin(angle), 0, Math.cos(angle)]);
      p.independent.forEach((v, i) => expect(v).toBeCloseTo(p.symmetric[i], 12));
      expect(p.independent[2]).toBeCloseTo(Math.sin(angle / 2) ** 4, 12);
    }
  });
  it("shows why antipodal stars need symmetrization", () => {
    const pair = pairProbabilities([0, 0, 1], [0, 0, -1], [1, 0, 0]);
    expect(pair.independent).toEqual([0.25, 0.5, 0.25]);
    expect(pair.symmetric).toEqual([0.5, 0, 0.5]);
  });

  it("adds normalized complex contributions to match every principal-axis probability", () => {
    const principal: [PrincipalAxis, Vec3][] = [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]];
    for (const raw of states) {
      const state = normalize(raw)!.state;
      const stars = majoranaStars(state);
      for (const [axis, n] of principal) {
        const cells = pairAmplitudes(...stars, axis);
        const probabilities = [cells[0].probability, cells[1].probability + cells[2].probability, cells[3].probability];
        const exact = outcomeProbabilities(state, n);
        probabilities.forEach((p, i) => expect(p).toBeCloseTo(exact[i], 10));
        expect(cells[1].total).toEqual(cells[2].total);
        expect(cells.reduce((sum, cell) => sum + cell.probability, 0)).toBeCloseTo(1, 12);
      }
    }
  });

  it("shows destructive interference in each mixed-sign tile for zero-z measured along x", () => {
    const cells = pairAmplitudes([0, 0, 1], [0, 0, -1], "x");
    for (const cell of [cells[1], cells[2]]) {
      expect(Math.abs(cell.ab.re)).toBeGreaterThan(0.3);
      expect(cell.ab.re).toBeCloseTo(-cell.ba.re, 12);
      expect(cell.probability).toBeCloseTo(0, 12);
    }
    expect(cells[0].probability).toBeCloseTo(0.5, 12);
    expect(cells[3].probability).toBeCloseTo(0.5, 12);
  });

  it("matches the Born rule for custom axes, including negative axes and poles", () => {
    const custom: Vec3[] = [...axes, [-1, 0, 0], [0, 0, -1], [0, -0.6, -0.8], [0.48, 0.64, 0.6]];
    for (const raw of states) {
      const state = normalize(raw)!.state;
      const stars = majoranaStars(state);
      for (const axis of custom) {
        const cells = pairAmplitudes(...stars, axis);
        const probabilities = [cells[0].probability, cells[1].probability + cells[2].probability, cells[3].probability];
        const exact = outcomeProbabilities(state, axis);
        probabilities.forEach((p, i) => expect(p).toBeCloseTo(exact[i], 10));
        expect(probabilities.reduce((sum, p) => sum + p)).toBeCloseTo(1, 12);
      }
    }
  });
});
