import { Vec3 } from "../spin-one/physics";

export const SWEEP_CURVATURE = Math.SQRT1_2;

export function inMiddleRegion(p: Vec3, n: Vec3): boolean {
  const u = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
  const transverse = Math.max(0, p[0] ** 2 + p[1] ** 2 + p[2] ** 2 - u * u);
  return Math.abs(u) <= SWEEP_CURVATURE * transverse + 1e-12;
}

/** null means the exact continuum union, not a dense finite approximation. */
export function excludedBySweep(p: Vec3, count: number | null): boolean {
  // A horizontal axis perpendicular to (x,y) has u=0, so its middle region contains p.
  if (count === null) return true;
  for (let i = 0; i < count; i++) {
    const phi = i * Math.PI / count;
    if (inMiddleRegion(p, [Math.cos(phi), Math.sin(phi), 0])) return true;
  }
  return false;
}

export function horizontalWitness(p: Vec3): Vec3 {
  const radius = Math.hypot(p[0], p[1]);
  return radius === 0 ? [1, 0, 0] : [-p[1] / radius, p[0] / radius, 0];
}
