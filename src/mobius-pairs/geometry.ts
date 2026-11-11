export type Point3 = [number, number, number];

export const TORUS = { major: 1.6, minor: 0.6 };
export const MOBIUS = { radius: 1.6, halfWidth: 0.8 };
const TAU = 2 * Math.PI;

/** Ordered pair (alpha, beta): alpha runs around the hole, beta around the tube. Scene axes, y up. */
export function torusPoint(alpha: number, beta: number): Point3 {
  const ring = TORUS.major + TORUS.minor * Math.cos(beta);
  return [ring * Math.cos(alpha), TORUS.minor * Math.sin(beta), ring * Math.sin(alpha)];
}

/** Möbius strip parametrized by angle u and signed width w in [-1, 1]; M(u + 2π, -w) = M(u, w). */
export function mobiusPoint(u: number, w: number): Point3 {
  const offset = w * MOBIUS.halfWidth;
  const ring = MOBIUS.radius + offset * Math.cos(u / 2);
  return [ring * Math.cos(u), offset * Math.sin(u / 2), ring * Math.sin(u)];
}

/**
 * Unordered pair {alpha, beta} -> strip coordinates. The chord joining the points has
 * normal direction (alpha + beta) / 2 and signed distance cos((beta - alpha) / 2) from the center;
 * both are unchanged by swapping the points.
 */
export function pairToMobius(alpha: number, beta: number) {
  let u = alpha + beta;
  let w = Math.cos((beta - alpha) / 2);
  const turns = Math.floor(u / TAU);
  u -= turns * TAU;
  if (turns % 2 !== 0) w = -w;
  return { u, w };
}

/** Inverse of pairToMobius: returns one ordering of the pair. */
export function mobiusToPair(u: number, w: number): [number, number] {
  const half = Math.acos(Math.max(-1, Math.min(1, w)));
  return [u / 2 - half, u / 2 + half];
}

/** Measurement along direction angle cut: +1 if both points are on the positive side, -1 if both negative, else 0. */
export function pairOutcome(alpha: number, beta: number, cut: number): 1 | 0 | -1 {
  const first = Math.cos(alpha - cut) >= 0;
  const second = Math.cos(beta - cut) >= 0;
  return first && second ? 1 : !first && !second ? -1 : 0;
}
