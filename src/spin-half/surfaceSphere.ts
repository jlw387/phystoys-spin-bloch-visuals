import * as THREE from "three";

export type V3 = [number, number, number];

export const STATE_SURFACE_AREA = Math.PI;

export interface SurfaceCap {
  geometry: THREE.BufferGeometry;
  /** Triangulated curved area divided by the exact whole-sphere area. */
  areaFraction: number;
}

/**
 * The state surface is |r - s/2| = 1/2, equivalently r(d) = s·d for s·d >= 0.
 * Its area element is (s·d) dOmega. Only the curved cap with m·r >= 0 is built;
 * no planar closing face contributes to either the mesh or its area.
 */
export function buildSurfaceCap(s: V3, m: V3, thetaSteps = 72, phiSteps = 96): SurfaceCap | null {
  const state = new THREE.Vector3(...s).normalize();
  const axis = new THREE.Vector3(...m).normalize();
  const cosine = THREE.MathUtils.clamp(state.dot(axis), -1, 1);
  if (cosine === -1) return null;

  const helper = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const q = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const a = new THREE.Vector3().crossVectors(axis, q);
  const center = state.clone().multiplyScalar(0.5);
  const maxTheta = Math.acos(-cosine);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const cols = phiSteps + 1;

  for (let i = 0; i <= thetaSteps; i++) {
    const theta = maxTheta * i / thetaSteps;
    for (let j = 0; j <= phiSteps; j++) {
      const phi = 2 * Math.PI * j / phiSteps;
      const normal = axis.clone().multiplyScalar(Math.cos(theta))
        .addScaledVector(q, Math.sin(theta) * Math.cos(phi))
        .addScaledVector(a, Math.sin(theta) * Math.sin(phi));
      const p = center.clone().addScaledVector(normal, 0.5);
      // Physics (x, y, z) -> scene (x, z, -y).
      positions.push(p.x, p.z, -p.y);
      normals.push(normal.x, normal.z, -normal.y);
    }
  }

  let area = 0;
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const vertex = (i: number) => new THREE.Vector3().fromArray(positions, 3 * i);
  const tri = (i0: number, i1: number, i2: number) => {
    indices.push(i0, i1, i2);
    const p = vertex(i0);
    edge1.subVectors(vertex(i1), p);
    edge2.subVectors(vertex(i2), p);
    area += edge1.cross(edge2).length() / 2;
  };
  for (let i = 0; i < thetaSteps; i++) {
    for (let j = 0; j < phiSteps; j++) {
      const i00 = i * cols + j;
      const i10 = i00 + cols;
      tri(i00, i10, i00 + 1);
      tri(i00 + 1, i10, i10 + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return { geometry, areaFraction: area / STATE_SURFACE_AREA };
}
