import { Quaternion, Vector3 } from "three";
import { State, Vec3, coherent, expectation, majoranaStars, outcomeProbabilities } from "../spin-one/physics";
import { c } from "../shared/complex";

export type ZeroShape = "disk" | "ring";
export type Outcome = 0 | 1 | 2;
export type BoundaryType = "paraboloid" | "cross" | "smooth-cross";

/** Transport the laboratory x/y axes by the shortest rotation taking z to the measurement axis. */
export function measurementFrame(axis: Vec3): { x: Vector3; y: Vector3 } {
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...axis));
  return { x: new Vector3(1, 0, 0).applyQuaternion(rotation), y: new Vector3(0, 1, 0).applyQuaternion(rotation) };
}

export function boundaryHeight(x: number, y: number, k: number, type: BoundaryType): number {
  const xx = x * x;
  const yy = y * y;
  if (type === "cross") return k * Math.min(xx, yy);
  if (type === "smooth-cross") return xx + yy === 0 ? 0 : k * xx * yy / (xx + yy);
  return k * (xx + yy);
}
export interface Sample {
  position: Vec3;
  outcome: Outcome;
}

export const direction = (theta: number, phi: number): Vec3 => [
  Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta),
];

/** Preserve an existing preparation when possible; otherwise recover an eigenstate's axis. */
export function inferPreparation(state: State, preferredAxis: Vec3): { axis: Vec3; outcome: Outcome } | null {
  const match = outcomeProbabilities(state, preferredAxis).findIndex((p) => p > 1 - 1e-8);
  if (match !== -1) return { axis: preferredAxis, outcome: match as Outcome };

  const spin = expectation(state);
  const length = Math.hypot(...spin);
  if (length > 1 - 1e-8) {
    const axis: Vec3 = [spin[0] / length, spin[1] / length, spin[2] / length];
    if (outcomeProbabilities(state, axis)[0] > 1 - 1e-8) return { axis, outcome: 0 };
  }
  const [axis] = majoranaStars(state);
  if (outcomeProbabilities(state, axis)[1] > 1 - 1e-8) return { axis, outcome: 1 };
  return null;
}

export function preparedState(theta: number, phi: number, m: Outcome): State {
  if (m === 0) return coherent(theta, phi);
  if (m === 2) return coherent(Math.PI - theta, phi + Math.PI);
  const a = -Math.sin(theta) / Math.SQRT2;
  const b = Math.cos(theta);
  const cc = Math.sin(theta) / Math.SQRT2;
  return [c(a), c(b * Math.cos(phi), b * Math.sin(phi)), c(cc * Math.cos(2 * phi), cc * Math.sin(2 * phi))];
}

/** Boundary ties go to the middle region. */
export function classify(p: Vec3, axis: Vec3, k: number, type: BoundaryType = "paraboloid", frame = measurementFrame(axis)): Outcome {
  const u = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
  const transverseSquared = Math.max(0, p[0] ** 2 + p[1] ** 2 + p[2] ** 2 - u * u);
  const x = p[0] * frame.x.x + p[1] * frame.x.y + p[2] * frame.x.z;
  const y = p[0] * frame.y.x + p[1] * frame.y.y + p[2] * frame.y.z;
  const edge = type === "paraboloid" ? k * transverseSquared : boundaryHeight(x, y, k, type);
  return u > edge + 1e-12 ? 0 : u < -edge - 1e-12 ? 2 : 1;
}

/** Equal-weight, equal-area (or equal-length ring) deterministic samples. */
export function sampleShape(preparation: Vec3, m: Outcome, zero: ZeroShape, radius: number, axis: Vec3, k: number, count = 20000, boundary: BoundaryType = "paraboloid"): { samples: Sample[]; fractions: Vec3 } {
  const s = new Vector3(...preparation);
  const helper = Math.abs(s.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const q = new Vector3().crossVectors(s, helper).normalize();
  const a = new Vector3().crossVectors(s, q);
  const counts: Vec3 = [0, 0, 0];
  const samples: Sample[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const frame = measurementFrame(axis);
  for (let i = 0; i < count; i++) {
    let p: Vector3;
    if (m === 1) {
      const angle = zero === "ring" ? 2 * Math.PI * (i + 0.5) / count : goldenAngle * i;
      const r = zero === "ring" ? radius : radius * Math.sqrt((i + 0.5) / count);
      p = q.clone().multiplyScalar(r * Math.cos(angle)).addScaledVector(a, r * Math.sin(angle));
    } else {
      const z = 1 - 2 * (i + 0.5) / count;
      const r = Math.sqrt(1 - z * z);
      const angle = goldenAngle * i;
      p = s.clone().multiplyScalar(z).addScaledVector(q, r * Math.cos(angle)).addScaledVector(a, r * Math.sin(angle));
      p.multiplyScalar(0.5).addScaledVector(s, m === 0 ? 0.5 : -0.5);
    }
    const position: Vec3 = [p.x, p.y, p.z];
    const outcome = classify(position, axis, k, boundary, frame);
    counts[outcome]++;
    samples.push({ position, outcome });
  }
  return { samples, fractions: counts.map((n) => n / count) as Vec3 };
}
