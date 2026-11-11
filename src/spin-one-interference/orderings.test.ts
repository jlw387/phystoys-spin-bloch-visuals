import { describe, expect, it } from "vitest";
import { pairAmplitudes } from "../spin-one-pair/probabilities";
import { orderingContributions } from "./orderings";

describe("fixed zero-z ordering diagrams", () => {
  it("maps each patch pair to the existing normalized amplitude contribution", () => {
    for (const degree of [0, 30, 90]) {
      const theta = degree * Math.PI / 180;
      const cells = pairAmplitudes([0, 0, 1], [0, 0, -1], [Math.sin(theta), 0, Math.cos(theta)]);
      for (const exchanged of [false, true]) {
        const contributions = orderingContributions(theta, exchanged);
        contributions.forEach((cell, i) => {
          expect(cell.contribution).toBeCloseTo((exchanged ? cells[i].ba : cells[i].ab).re, 12);
          expect(cell.contribution ** 2).toBeCloseTo(cell.firstProbability * cell.secondProbability / 2, 12);
        });
        expect(contributions.reduce((sum, cell) => sum + cell.firstProbability * cell.secondProbability, 0)).toBeCloseTo(1, 12);
      }
    }
  });
});
