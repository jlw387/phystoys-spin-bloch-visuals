import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { V3, buildSurfaceCap, STATE_SURFACE_AREA } from "./surfaceSphere";

const unitV = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const states: V3[] = [[0, 0, 1], [1, 0, 0], unitV([1, 2, 3]), unitV([-1, 0.3, -0.7])];
const axes: V3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], unitV([2, -3, 1])];
const dot = (s: V3, n: V3) => s[0] * n[0] + s[1] * n[1] + s[2] * n[2];

describe("surface-area state sphere", () => {
  it("curved mesh area matches the Born probability for arbitrary orientations", () => {
    for (const s of states) {
      for (const n of axes) {
        const cap = buildSurfaceCap(s, n);
        expect(Math.abs((cap?.areaFraction ?? 0) - (1 + dot(s, n)) / 2)).toBeLessThan(0.002);
        cap?.geometry.dispose();
      }
    }
  });

  it("complementary caps cover the whole sphere", () => {
    for (const s of states) {
      for (const n of axes) {
        const plus = buildSurfaceCap(s, n);
        const minus = buildSurfaceCap(s, [-n[0], -n[1], -n[2]]);
        expect(Math.abs((plus?.areaFraction ?? 0) + (minus?.areaFraction ?? 0) - 1)).toBeLessThan(0.002);
        plus?.geometry.dispose();
        minus?.geometry.dispose();
      }
    }
  });

  it("handles aligned, perpendicular, opposite and near-tangent measurements", () => {
    for (const angle of [0, 0.0001, Math.PI / 2, Math.PI - 0.0001, Math.PI]) {
      const cap = buildSurfaceCap([0, 0, 1], [Math.sin(angle), 0, Math.cos(angle)]);
      expect(Math.abs((cap?.areaFraction ?? 0) - (1 + Math.cos(angle)) / 2)).toBeLessThan(0.002);
      cap?.geometry.dispose();
    }
    expect(buildSurfaceCap([0, 0, 1], [0, 0, -1])).toBeNull();
  });

  it("contains only curved-sphere vertices on the selected side, with no closing face", () => {
    const s = unitV([1, 2, 3]);
    const n = unitV([2, -3, 1]);
    const cap = buildSurfaceCap(s, n)!;
    const positions = cap.geometry.getAttribute("position");
    const center = new Vector3(s[0] / 2, s[2] / 2, -s[1] / 2);
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i);
      expect(p.distanceTo(center)).toBeCloseTo(0.5, 6);
      expect(dot([p.x, -p.z, p.y], n)).toBeGreaterThanOrEqual(-1e-7);
    }
    const indices = cap.geometry.getIndex()!;
    let area = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(positions, indices.getX(i));
      const b = new Vector3().fromBufferAttribute(positions, indices.getX(i + 1));
      const c = new Vector3().fromBufferAttribute(positions, indices.getX(i + 2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    expect(cap.areaFraction).toBeCloseTo(area / STATE_SURFACE_AREA, 7);
    cap.geometry.dispose();
  });
});
