import { describe, expect, it } from "vitest";
import { parseComplex } from "../shared/complex";
import { analyze, normalize, sigmaUncertainties } from "./physics";

const S = (a: string, b: string) => ({ alpha: parseComplex(a), beta: parseComplex(b) });
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

describe("parseComplex", () => {
  it("parses assorted forms", () => {
    expect(parseComplex("1")).toEqual({ re: 1, im: 0 });
    expect(parseComplex("0.5-0.5i")).toEqual({ re: 0.5, im: -0.5 });
    expect(parseComplex("1+2i")).toEqual({ re: 1, im: 2 });
    expect(parseComplex("2i")).toEqual({ re: 0, im: 2 });
    expect(parseComplex("-i")).toEqual({ re: -0, im: -1 });
    expect(parseComplex("0.5 − 0.25i")).toEqual({ re: 0.5, im: -0.25 });
    const z = parseComplex("i/√2");
    close(z.re, 0);
    close(z.im, Math.SQRT1_2);
    const w = parseComplex("(1+i)/sqrt(2)");
    close(w.re, Math.SQRT1_2);
    close(w.im, Math.SQRT1_2);
    const e = parseComplex("exp(i*pi)");
    close(e.re, -1);
  });
  it("rejects bad input", () => {
    expect(() => parseComplex("")).toThrow();
    expect(() => parseComplex("1+")).toThrow();
    expect(() => parseComplex("foo")).toThrow();
    expect(() => parseComplex("(1")).toThrow();
    expect(() => parseComplex("1/0")).toThrow();
  });
});

describe("analyze", () => {
  it("z eigenstates", () => {
    const up = analyze(S("1", "0"));
    close(up.sigma[2], 1);
    close(up.sigma[0], 0);
    const dn = analyze(S("0", "1"));
    close(dn.sigma[2], -1);
  });
  it("x and y eigenstates", () => {
    close(analyze(S("1", "1")).sigma[0], 1);
    close(analyze(S("1", "i")).sigma[1], 1);
    close(analyze(S("1", "-i")).sigma[1], -1);
  });
  it("unnormalized input matches normalized", () => {
    const a = analyze(S("3", "4i"));
    close(a.norm, 5);
    const b = analyze(S("0.6", "0.8i"));
    for (let k = 0; k < 3; k++) close(a.sigma[k], b.sigma[k]);
    close(Math.hypot(...a.sigma), 1);
  });
  it("global phase does not matter", () => {
    const a = analyze(S("1", "1+i"));
    const b = analyze(S("i", "i*(1+i)"));
    for (let k = 0; k < 3; k++) close(a.sigma[k], b.sigma[k]);
  });
  it("angles reproduce the Bloch vector", () => {
    const a = analyze(S("1", "1+2i"));
    close(a.sigma[0], Math.sin(a.theta) * Math.cos(a.phi));
    close(a.sigma[1], Math.sin(a.theta) * Math.sin(a.phi));
    close(a.sigma[2], Math.cos(a.theta));
  });
  it("uncertainties: zero on own eigenstate, one on the others, and relation holds", () => {
    const u = sigmaUncertainties(analyze(S("1", "0")).sigma);
    close(u[2], 0);
    close(u[0], 1);
    close(u[1], 1);
    const a = analyze(S("1", "1+2i"));
    const d = sigmaUncertainties(a.sigma);
    expect(d[0] * d[1]).toBeGreaterThanOrEqual(Math.abs(a.sigma[2]) - 1e-12);
    expect(d[1] * d[2]).toBeGreaterThanOrEqual(Math.abs(a.sigma[0]) - 1e-12);
    expect(d[2] * d[0]).toBeGreaterThanOrEqual(Math.abs(a.sigma[1]) - 1e-12);
  });
  it("rejects the zero vector", () => {
    expect(() => normalize(S("0", "0"))).toThrow();
  });
});
