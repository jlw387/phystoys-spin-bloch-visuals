import { describe, expect, it } from "vitest";
import { Vec3 } from "../spin-one/physics";
import { pairProbabilities } from "./probabilities";
import { circleConstruction, distanceDiagramSvg, distanceProducts } from "./distances";

const unit = (v: number[]) => {
  const r = Math.hypot(...v);
  return v.map((x) => x / r) as Vec3;
};

describe("distance-product picture", () => {
  it("reproduces the exact spin-1 probabilities for many stars and axes", () => {
    let seed = 3;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let k = 0; k < 500; k++) {
      const a = unit([random(), random(), random()]);
      const b = unit([random(), random(), random()]);
      const n = unit([random(), random(), random()]);
      const { rows, d, dn, mr, mn, A, B } = distanceProducts(a, b, n);
      expect(A).toBeCloseTo(mn + dn, 12);
      expect(B).toBeCloseTo(mn - dn, 12);
      expect(dn).toBeCloseTo(d[0] * n[0] + d[1] * n[1] + d[2] * n[2], 12);
      expect(rows[1].product).toBeCloseTo(mr * mr + dn * dn, 12);
      const exact = pairProbabilities(a, b, n).symmetric;
      expect(rows[0].probability).toBeCloseTo(exact[0], 12);
      expect(rows[1].probability + rows[2].probability).toBeCloseTo(exact[1], 12);
      expect(rows[3].probability).toBeCloseTo(exact[2], 12);
      // The two distances from m are always equal: m projects to the midpoint of the tip projections.
      expect(rows[1].distances[0]).toBeCloseTo(rows[1].distances[1], 12);
    }
  });

  it("matches the worked examples", () => {
    const z: Vec3 = [0, 0, 1];
    const minusZ: Vec3 = [0, 0, -1];
    const along = (n: Vec3) => distanceProducts(z, minusZ, n).rows.map((r) => r.probability);
    along(z).forEach((p, i) => expect(p).toBeCloseTo([0, 0.5, 0.5, 0][i], 12));
    along([1, 0, 0]).forEach((p, i) => expect(p).toBeCloseTo([0.5, 0, 0, 0.5][i], 12));
    expect(distanceProducts(z, z, z).rows[0].product).toBeCloseTo(4, 12);
  });

  it("builds the circle construction: tangent squares, radius squares, right triangles", () => {
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let k = 0; k < 300; k++) {
      const a = unit([random(), random(), random()]);
      const b = unit([random(), random(), random()]);
      const n = unit([random(), random(), random()]);
      const c = circleConstruction(a, b, n);
      // A and B lie on the circle centred at m.
      expect(Math.hypot(c.A - c.M[0], c.M[1])).toBeCloseTo(c.H, 12);
      expect(Math.hypot(c.B - c.M[0], c.M[1])).toBeCloseTo(c.H, 12);
      for (const [tangent, row] of [[c.plus, c.rows[0]], [c.minus, c.rows[3]]] as const) {
        // Power of a point: tangent square equals the secant product.
        expect(tangent.length ** 2).toBeCloseTo(row.product, 10);
        // The tangent point lies on the circle and the radius is perpendicular to the tangent.
        expect(Math.hypot(tangent.point[0] - c.M[0], tangent.point[1] - c.M[1])).toBeCloseTo(c.H, 10);
        const radial = [tangent.point[0] - c.M[0], tangent.point[1] - c.M[1]];
        const along = [tangent.point[0] - tangent.pole[0], tangent.point[1] - tangent.pole[1]];
        expect(radial[0] * along[0] + radial[1] * along[1]).toBeCloseTo(0, 8);
        expect(Math.hypot(...along)).toBeCloseTo(tangent.length, 8);
      }
      expect(c.plus.hypotenuse ** 2 + c.minus.hypotenuse ** 2).toBeCloseTo(c.total, 12);
    }
  });

  it("draws four squares whose areas match the numerators", () => {
    const a = unit([1, 2, 3]);
    const b = unit([-2, 3, 1]);
    const n = unit([3, -1, 2]);
    const svg = distanceDiagramSvg(a, b, n, ["#ff0000", "#a0a0a0", "#ff00ff"]);
    const areas = [...svg.matchAll(/data-area="([^"]+)"/g)].map((match) => Number(match[1]));
    const { rows } = distanceProducts(a, b, n);
    [rows[0].product, rows[3].product, rows[1].product, rows[2].product]
      .forEach((product, i) => expect(areas[i]).toBeCloseTo(product, 10));
  });

  it("keeps every square on a consistent side during the +z → −z sweep measured along z", () => {
    const z: Vec3 = [0, 0, 1];
    for (let degrees = 0; degrees <= 180; degrees += 0.5) {
      const g = degrees * Math.PI / 180;
      const svg = distanceDiagramSvg(z, [Math.sin(g), 0, Math.cos(g)], z, ["red", "gray", "magenta"]);
      expect(svg).not.toMatch(/NaN|Infinity/);
      const c = circleConstruction(z, [Math.sin(g), 0, Math.cos(g)], z);
      // The +n pole lies on the circle here (A = 1); its radius square used to flip on rounding noise.
      for (const t of [c.plus, c.minus]) {
        const away = [-t.side * t.radial[1], t.side * t.radial[0]];
        expect(away[1]).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it("orients radius squares away from the pole and tangent squares away from m", () => {
    let seed = 5;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let k = 0; k < 300; k++) {
      const c = circleConstruction(unit([random(), random(), random()]), unit([random(), random(), random()]), unit([random(), random(), random()]));
      for (const t of [c.plus, c.minus]) {
        if (t.length < 1e-6 || c.H < 1e-6) continue;
        const away = [-t.side * t.radial[1], t.side * t.radial[0]];
        const towardPole = [t.pole[0] - t.point[0], t.pole[1] - t.point[1]];
        expect(away[0] * towardPole[0] + away[1] * towardPole[1]).toBeLessThan(0);
      }
    }
  });

  it("handles collapsed circles without NaN", () => {
    const z: Vec3 = [0, 0, 1];
    for (const [a, b, n] of [[z, [0, 0, -1], [1, 0, 0]], [z, z, z], [z, z, [0, 0, -1]], [z, [0, 0, -1], z]] as [Vec3, Vec3, Vec3][]) {
      expect(distanceDiagramSvg(a, b, n, ["red", "gray", "magenta"])).not.toMatch(/NaN|Infinity/);
    }
  });
});
