import { formatNumber } from "../shared/complex";
import { Vec3 } from "../spin-one/physics";

const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Point in the plane spanned by the measurement axis (first coordinate) and m's perpendicular component (second). */
export type Point2 = [number, number];

/**
 * Each joint outcome's numerator is a product of distances from a reference point to the two star tips
 * projected onto the measurement axis: -n for ++, +n for --, and m = (a+b)/2 for each mixed outcome.
 * Dividing by 2(1 + |m|^2) gives the exact joint probabilities.
 */
export function distanceProducts(a: Vec3, b: Vec3, n: Vec3) {
  const A = dot(a, n);
  const B = dot(b, n);
  const m: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const d: Vec3 = [(a[0] - b[0]) / 2, (a[1] - b[1]) / 2, (a[2] - b[2]) / 2];
  const dn = dot(d, n);
  const mn = dot(m, n);
  const mr = Math.sqrt(Math.max(0, dot(m, m) - mn * mn));
  const toTip = (t: number) => Math.hypot(mr, mn - t);
  const rows = [
    { label: "++", from: "−n", distances: [1 + A, 1 + B] },
    { label: "+−", from: "m", distances: [toTip(A), toTip(B)] },
    { label: "−+", from: "m", distances: [toTip(A), toTip(B)] },
    { label: "−−", from: "+n", distances: [1 - A, 1 - B] },
  ].map((row) => ({ ...row, product: row.distances[0] * row.distances[1] }));
  const total = 2 * (1 + dot(m, m));
  return { A, B, m, d, dn, mn, mr, q: dot(m, m), total, rows: rows.map((row) => ({ ...row, probability: row.product / total })) };
}

/**
 * The circle centred at m through A and B (radius H). The axis is a secant through each pole, so the power of
 * a pole, |pole-A||pole-B|, equals its squared tangent length; the squared radius H^2 gives each mixed outcome.
 * Each pole, its tangent point T and m form a right triangle: |m - pole|^2 = t^2 + H^2.
 */
export function circleConstruction(a: Vec3, b: Vec3, n: Vec3) {
  const result = distanceProducts(a, b, n);
  const M: Point2 = [result.mn, result.mr];
  const H = Math.sqrt(result.rows[1].product);
  // side = -1 for -n and +1 for +n selects the tangent farther from the axis (m never lies below it), and stays
  // well-defined when a pole sits on the circle or the circle collapses, so squares never flip between frames.
  const tangentFrom = (pole: Point2, side: 1 | -1) => {
    const dx = pole[0] - M[0];
    const dy = pole[1] - M[1];
    const distance = Math.hypot(dx, dy);
    const length = Math.sqrt(Math.max(0, distance * distance - H * H));
    const base = distance < 1e-12 ? (side < 0 ? Math.PI : 0) : Math.atan2(dy, dx);
    const angle = base + side * Math.acos(Math.min(1, distance < 1e-12 ? 0 : H / distance));
    const radial: Point2 = [Math.cos(angle), Math.sin(angle)];
    const point: Point2 = [M[0] + H * radial[0], M[1] + H * radial[1]];
    return { pole, point, radial, side, length, hypotenuse: distance };
  };
  return { ...result, M, H, plus: tangentFrom([-1, 0], -1), minus: tangentFrom([1, 0], 1) };
}

type Tangent = ReturnType<typeof circleConstruction>["plus"];

/** Square on the tangent segment, extending radially outward (away from m). */
function tangentSquare(t: Tangent): Point2[] {
  const w: Point2 = [t.length * t.radial[0], t.length * t.radial[1]];
  return [t.pole, t.point, [t.point[0] + w[0], t.point[1] + w[1]], [t.pole[0] + w[0], t.pole[1] + w[1]]];
}

/** Square on the radius m→T, extending along the tangent line away from the pole. */
function radiusSquare(M: Point2, H: number, t: Tangent): Point2[] {
  const w: Point2 = [-t.side * H * t.radial[1], t.side * H * t.radial[0]];
  return [M, t.point, [t.point[0] + w[0], t.point[1] + w[1]], [M[0] + w[0], M[1] + w[1]]];
}

export function distanceDiagramSvg(a: Vec3, b: Vec3, n: Vec3, colors: string[], c = circleConstruction(a, b, n)) {
  const [plus, zero, minus] = colors;
  const pieces = [
    { square: tangentSquare(c.plus), color: plus, label: "t₊²" },
    { square: tangentSquare(c.minus), color: minus, label: "t₋²" },
    { square: radiusSquare(c.M, c.H, c.plus), color: zero, label: "H²" },
    { square: radiusSquare(c.M, c.H, c.minus), color: zero, label: "H²" },
  ];
  const all: Point2[] = [[-1.1, 0], [1.1, 0], [c.M[0] - c.H, c.M[1] - c.H], [c.M[0] + c.H, c.M[1] + c.H], [c.mn, -0.35],
    ...pieces.flatMap((piece) => piece.square)];
  const minX = Math.min(...all.map((p) => p[0])) - 0.2;
  const maxX = Math.max(...all.map((p) => p[0])) + 0.2;
  const minY = Math.min(...all.map((p) => p[1])) - 0.15;
  const maxY = Math.max(...all.map((p) => p[1])) + 0.2;
  const S = 150;
  const X = (x: number) => (x - minX) * S;
  const Y = (y: number) => (maxY - y) * S;
  const pt = (p: Point2) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`;
  const line = (p: Point2, q: Point2, stroke: string, extra = "") =>
    `<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(q[0])}" y2="${Y(q[1])}" stroke="${stroke}" ${extra}/>`;
  const squares = pieces.map((piece) => {
    const side = Math.hypot(piece.square[1][0] - piece.square[0][0], piece.square[1][1] - piece.square[0][1]);
    const cx = piece.square.reduce((s, p) => s + p[0], 0) / 4;
    const cy = piece.square.reduce((s, p) => s + p[1], 0) / 4;
    return `<polygon data-square="${piece.label}" data-area="${side * side}" points="${piece.square.map(pt).join(" ")}" fill="${piece.color}" fill-opacity="0.28" stroke="${piece.color}" stroke-width="1.5"/>` +
      (side > 0.18 ? `<text x="${X(cx)}" y="${Y(cy) + 5}" text-anchor="middle">${piece.label}</text>` : "");
  }).join("");
  const tangent = (t: typeof c.plus, color: string) =>
    line(t.pole, c.M, "#6f7a8a", `stroke-width="1.2" stroke-dasharray="3 4"`) +
    line(t.pole, t.point, color, `stroke-width="3"`) +
    line(c.M, t.point, "#a0a0a0", `stroke-width="2"`) +
    `<circle cx="${X(t.point[0])}" cy="${Y(t.point[1])}" r="3.5" fill="#e6e9ef"/>`;
  const axisY = Y(0);
  return `<svg viewBox="0 0 ${((maxX - minX) * S).toFixed(1)} ${((maxY - minY) * S).toFixed(1)}" role="img" aria-label="Circle centred at m through A and B. Squares on the tangents from the poles give the plus-one and minus-one numerators; squares on the radius H give the zero numerator.">
    ${squares}
    <line x1="${X(-1.1)}" y1="${axisY}" x2="${X(1.1)}" y2="${axisY}" stroke="#9caec8" stroke-width="1.5"/>
    ${c.H > 1e-9 ? `<circle cx="${X(c.M[0])}" cy="${Y(c.M[1])}" r="${c.H * S}" fill="none" stroke="#e6e9ef" stroke-width="1.5"/>` : ""}
    ${tangent(c.plus, plus)}${tangent(c.minus, minus)}
    ${line([c.mn, 0], c.M, "#ffa66b", `stroke-width="2" stroke-dasharray="5 4"`)}
    ${line([c.mn, -0.2], [c.A, -0.2], "#63dfcf", `stroke-width="3"`)}
    <text x="${X((c.mn + c.A) / 2)}" y="${Y(-0.2) + 18}" text-anchor="middle" fill="#63dfcf">|dₙ|</text>
    <circle cx="${X(-1)}" cy="${axisY}" r="5" fill="${minus}"/><circle cx="${X(1)}" cy="${axisY}" r="5" fill="${plus}"/>
    <text x="${X(-1) - 8}" y="${axisY + 20}" text-anchor="end">−n</text><text x="${X(1) + 8}" y="${axisY + 20}">+n</text>
    <circle cx="${X(c.A)}" cy="${axisY}" r="6" fill="#ffb347"/><circle cx="${X(c.B)}" cy="${axisY}" r="4" fill="#ce85ff"/>
    <text x="${X(c.A) + 6}" y="${axisY + 20}" fill="#ffb347">A</text><text x="${X(c.B) - 14}" y="${axisY + 20}" fill="#ce85ff">B</text>
    <circle cx="${X(c.M[0])}" cy="${Y(c.M[1])}" r="5" fill="#ffffff"/>
    <text x="${X(c.M[0]) + 9}" y="${Y(c.M[1]) - 8}">m</text>
  </svg>`;
}

export function renderDistancePanel(stars: [Vec3, Vec3] | null, n: Vec3, colors: string[]) {
  const figure = document.getElementById("distance-diagram")!;
  const table = document.getElementById("distance-table")!;
  const equations = document.getElementById("distance-equations")!;
  if (!stars) {
    figure.innerHTML = "";
    table.innerHTML = "";
    equations.innerHTML = "";
    return;
  }
  const c = circleConstruction(...stars, n);
  const f = formatNumber;
  figure.innerHTML = distanceDiagramSvg(...stars, n, colors, c);
  const rows = [
    { color: colors[0], label: "++ → +1", square: "tangent t₊ from −n", side: c.plus.length, check: `|−n A| × |−n B| = ${f(c.rows[0].distances[0])} × ${f(c.rows[0].distances[1])}`, row: c.rows[0] },
    { color: colors[1], label: "+− → 0", square: "radius H", side: c.H, check: `|m A| × |m B| = ${f(c.H)} × ${f(c.H)}`, row: c.rows[1] },
    { color: colors[1], label: "−+ → 0", square: "radius H", side: c.H, check: "same as +−", row: c.rows[2] },
    { color: colors[2], label: "−− → −1", square: "tangent t₋ from +n", side: c.minus.length, check: `|+n A| × |+n B| = ${f(c.rows[3].distances[0])} × ${f(c.rows[3].distances[1])}`, row: c.rows[3] },
  ];
  table.innerHTML = `<thead><tr><th>Outcome</th><th>Square on</th><th>Side</th><th>Same area as</th><th>Area</th><th>Probability</th></tr></thead><tbody>${
    rows.map((r) => `<tr><td style="color:${r.color}">${r.label}</td><td>${r.square}</td><td>${f(r.side)}</td>` +
      `<td>${r.check}</td><td>${f(r.row.product)}</td><td>${f(r.row.probability)}</td></tr>`).join("")
  }</tbody><tfoot><tr><td colspan="4">Total = |m + n|² + |m − n|² = 2(1 + |m|²), with |m|² = rim-disk fraction ${f(c.q)}</td>` +
    `<td>${f(c.total)}</td><td>${f(c.rows.reduce((s, r) => s + r.probability, 0))}</td></tr></tfoot>`;
  const p0 = c.rows[1].probability + c.rows[2].probability;
  const mperp2 = c.mr * c.mr;
  const dn2 = c.dn * c.dn;
  const line = (color: string, label: string, square: string, symbolic: string, numeric: string, p: number) =>
    `<p><span style="color:${color}">${label}</span> = ${square} / 2(1 + |m|²) = ${symbolic} / 2(1 + |m|²)` +
    ` = ${numeric} / ${f(c.total)} = <strong>${f(p)}</strong></p>`;
  equations.innerHTML =
    `<p class="hint">With mₙ = m·n = ${f(c.mn)}, dₙ = d·n = ${f(c.dn)}, |m⊥|² = |m|² − mₙ² = ${f(mperp2)}, ` +
    `A = mₙ + dₙ = ${f(c.A)}, B = mₙ − dₙ = ${f(c.B)}, |m|² = ${f(c.q)}:</p>` +
    line(colors[0], "P(+1)", "t₊²", "(1 + mₙ)² − dₙ²", `(${f(1 + c.mn)})² − ${f(dn2)}`, c.rows[0].probability) +
    line(colors[1], "P(0)", "2H²", "2(|m⊥|² + dₙ²)", `2(${f(mperp2)} + ${f(dn2)})`, p0) +
    line(colors[2], "P(−1)", "t₋²", "(1 − mₙ)² − dₙ²", `(${f(1 - c.mn)})² − ${f(dn2)}`, c.rows[3].probability);
}
