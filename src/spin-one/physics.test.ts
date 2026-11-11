import { describe, expect, it } from "vitest";
import { c } from "../shared/complex";
import { State, Vec3, coherent, expectation, husimi, majoranaStars, normalize, outcomeProbabilities, uncertainties } from "./physics";

const S = (a: number, b: number, cc: number, im: [number, number, number] = [0, 0, 0]): State => {
  const n = normalize([c(a, im[0]), c(b, im[1]), c(cc, im[2])])!;
  return n.state;
};
const close = (a: number, b: number, d = 8) => expect(a).toBeCloseTo(b, d);
const dir = (t: number, p: number): Vec3 => [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];

describe("expectation / uncertainty", () => {
  it("matches known states", () => {
    const e = expectation(S(1, 0, 0));
    close(e[2], 1);
    const m0 = expectation(S(0, 1, 0));
    m0.forEach((x) => close(x, 0));
    const x = expectation(S(1, Math.SQRT2, 1));
    close(x[0], 1);
    const g = expectation(S(1, 0, 0, [0, 1, 0]).map((v, i) => (i === 1 ? { re: 0, im: Math.SQRT1_2 } : v)) as State);
    close(Math.hypot(...g), 0.866025403, 6);
  });
  it("coherent states point along n and have ΔS⊥ = 1/√2", () => {
    const psi = coherent(0.7, 1.9);
    const e = expectation(psi);
    const n = dir(0.7, 1.9);
    e.forEach((v, i) => close(v, n[i]));
    close(uncertainties(S(1, 0, 0))[0], Math.SQRT1_2);
    close(uncertainties(S(1, 0, 0))[2], 0);
  });
});

describe("Husimi / probabilities", () => {
  it("coherent state gives cos^4(γ/2) and the m=0 ring", () => {
    const psi = coherent(0, 0);
    for (const t of [0, 0.4, 1.3, 2.5, Math.PI]) {
      const p = outcomeProbabilities(psi, dir(t, 0.3));
      close(p[0], Math.cos(t / 2) ** 4);
      close(p[1], Math.sin(t) ** 2 / 2);
      close(p[2], Math.sin(t / 2) ** 4);
    }
  });
  it("averages to 1/3 over a coarse sphere grid", () => {
    const psi = S(0.3, 0.5, -0.2, [0.4, -0.1, 0.6]);
    let sum = 0;
    let wsum = 0;
    for (let i = 0; i < 200; i++) {
      const t = ((i + 0.5) / 200) * Math.PI;
      for (let j = 0; j < 200; j++) {
        const w = Math.sin(t);
        sum += w * husimi(psi, dir(t, (j / 200) * 2 * Math.PI));
        wsum += w;
      }
    }
    close(sum / wsum, 1 / 3, 4);
  });
});

describe("Majorana stars", () => {
  const near = (v: Vec3, w: Vec3) => v.forEach((x, i) => close(x, w[i], 6));
  it("coherent state: both stars at its direction", () => {
    const [s1, s2] = majoranaStars(S(1, 0, 0));
    near(s1, [0, 0, 1]);
    near(s2, [0, 0, 1]);
    const n = dir(1.1, 0.4);
    const [t1, t2] = majoranaStars(coherent(1.1, 0.4));
    near(t1, n);
    near(t2, n);
  });
  it("m=0 along z: stars at ±z", () => {
    const [s1, s2] = majoranaStars(S(0, 1, 0));
    expect(s1[2] * s2[2]).toBeCloseTo(-1, 6);
  });
  it("m=−1: both stars at south pole", () => {
    const [s1, s2] = majoranaStars(S(0, 0, 1));
    near(s1, [0, 0, -1]);
    near(s2, [0, 0, -1]);
  });
  it("Q vanishes at the antipodes of the stars for a generic state", () => {
    const psi = S(0.3, 0.5, -0.2, [0.4, -0.1, 0.6]);
    for (const s of majoranaStars(psi)) close(husimi(psi, [-s[0], -s[1], -s[2]]), 0, 8);
  });
});
