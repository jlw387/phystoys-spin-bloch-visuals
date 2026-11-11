import { Complex, abs, abs2, add, c, conj, div, mul, scale, sqrt, sub } from "../shared/complex";

/** Amplitudes (m = +1, 0, −1) along z. */
export type State = [Complex, Complex, Complex];
export type Vec3 = [number, number, number];

const R = Math.SQRT1_2;
const Z = c(0);
const SX: Complex[][] = [
  [Z, c(R), Z],
  [c(R), Z, c(R)],
  [Z, c(R), Z],
];
const SY: Complex[][] = [
  [Z, c(0, -R), Z],
  [c(0, R), Z, c(0, -R)],
  [Z, c(0, R), Z],
];
const SZ: Complex[][] = [
  [c(1), Z, Z],
  [Z, Z, Z],
  [Z, Z, c(-1)],
];
const OPS = [SX, SY, SZ];

const apply = (m: Complex[][], v: State): State =>
  m.map((row) => row.reduce((s, e, j) => add(s, mul(e, v[j])), Z)) as State;
const inner = (a: State, b: State): Complex => a.reduce((s, x, i) => add(s, mul(conj(x), b[i])), Z);

export function normalize(v: State): { state: State; norm: number } | null {
  const norm = Math.sqrt(v.reduce((s, x) => s + abs2(x), 0));
  if (!(norm > 0)) return null;
  return { state: v.map((x) => scale(x, 1 / norm)) as State, norm };
}

/** ⟨S⟩ in units of ħ for a normalized state. */
export function expectation(psi: State): Vec3 {
  return OPS.map((m) => inner(psi, apply(m, psi)).re) as Vec3;
}

/** ΔS in units of ħ for a normalized state. */
export function uncertainties(psi: State): Vec3 {
  const e = expectation(psi);
  return OPS.map((m, i) => {
    const sq = inner(psi, apply(m, apply(m, psi))).re;
    return Math.sqrt(Math.max(0, sq - e[i] * e[i]));
  }) as Vec3;
}

/** Spin-coherent state |n, +1⟩ for the direction with polar angle θ and azimuth φ. */
export function coherent(theta: number, phi: number): State {
  const u = Math.cos(theta / 2);
  const v = Math.sin(theta / 2);
  return [c(u * u), c(Math.SQRT2 * u * v * Math.cos(phi), Math.SQRT2 * u * v * Math.sin(phi)), c(v * v * Math.cos(2 * phi), v * v * Math.sin(2 * phi))];
}

const angles = (n: Vec3): [number, number] => [Math.acos(Math.max(-1, Math.min(1, n[2]))), Math.atan2(n[1], n[0])];

/** Husimi function Q(n) = |⟨n,+1|ψ⟩|² = P(m = +1 along n). */
export function husimi(psi: State, n: Vec3): number {
  const [theta, phi] = angles(n);
  return abs2(inner(coherent(theta, phi), psi));
}

/** [P(+1), P(0), P(−1)] along the unit direction n. */
export function outcomeProbabilities(psi: State, n: Vec3): Vec3 {
  const plus = husimi(psi, n);
  const minus = husimi(psi, [-n[0], -n[1], -n[2]]);
  return [plus, Math.max(0, 1 - plus - minus), minus];
}

const fromAngles = (theta: number, phi: number): Vec3 => [
  Math.sin(theta) * Math.cos(phi),
  Math.sin(theta) * Math.sin(phi),
  Math.cos(theta),
];

/**
 * Majorana stars: the two unit directions whose coherent states make up ψ.
 * They are antipodal to the zeros of Q. Roots ζ = tan(θ/2)e^{−iφ} of
 * c ζ² + √2 b ζ + a = 0 give the zeros; ζ = ∞ is the south pole.
 */
export function majoranaStars(psi: State): [Vec3, Vec3] {
  const [a, b, cc] = psi;
  const eps = 1e-9;
  const disc = sub(scale(mul(b, b), 2), scale(mul(a, cc), 4));
  const rootB = scale(b, Math.SQRT2);
  // Stable quadratic formula: pick the sign that avoids cancellation.
  const sd = sqrt(disc);
  const sign = rootB.re * sd.re + rootB.im * sd.im >= 0 ? 1 : -1;
  const q = scale(add(rootB, scale(sd, sign)), -0.5);
  const roots: (Complex | null)[] = [];
  if (abs(cc) < eps) roots.push(abs(rootB) < eps ? null : div(scale(a, -1), rootB), null);
  else if (abs(q) < eps) roots.push(c(0), c(0));
  else roots.push(div(q, cc), div(a, q));
  return roots.map((z) => {
    const zeroDir = z === null ? ([0, 0, -1] as Vec3) : fromAngles(2 * Math.atan(abs(z)), -Math.atan2(z.im, z.re));
    return [-zeroDir[0] || 0, -zeroDir[1] || 0, -zeroDir[2] || 0] as Vec3;
  }) as [Vec3, Vec3];
}
