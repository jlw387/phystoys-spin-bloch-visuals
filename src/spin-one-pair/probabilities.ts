import { Vec3 } from "../spin-one/physics";
import { Complex, abs2, add, c, conj, mul, scale } from "../shared/complex";

export type PrincipalAxis = "x" | "y" | "z";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function spinor(n: Vec3): [Complex, Complex] {
  const theta = Math.acos(Math.max(-1, Math.min(1, n[2])));
  const phi = Math.atan2(n[1], n[0]);
  return [c(Math.cos(theta / 2)), c(Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi))];
}

function measurementAmplitudes(n: Vec3, axis: PrincipalAxis | Vec3): [Complex, Complex] {
  const [up, down] = spinor(n);
  const direction: Vec3 = typeof axis !== "string" ? axis : axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const [u, v] = spinor(direction);
  return [
    add(mul(conj(u), up), mul(conj(v), down)),
    add(scale(mul(v, up), -1), mul(u, down)),
  ];
}

export function pairAmplitudes(a: Vec3, b: Vec3, axis: PrincipalAxis | Vec3) {
  const first = measurementAmplitudes(a, axis);
  const second = measurementAmplitudes(b, axis);
  const overlap = add(mul(conj(spinor(a)[0]), spinor(b)[0]), mul(conj(spinor(a)[1]), spinor(b)[1]));
  const normalization = Math.sqrt(2 * (1 + abs2(overlap)));
  return ([ [0, 0], [0, 1], [1, 0], [1, 1] ] as const).map(([i, j]) => {
    const ab = scale(mul(first[i], second[j]), 1 / normalization);
    const ba = scale(mul(second[i], first[j]), 1 / normalization);
    const total = add(ab, ba);
    return { ab, ba, total, probability: abs2(total) };
  });
}

export function pairProbabilities(a: Vec3, b: Vec3, n: Vec3) {
  const A = Math.max(-1, Math.min(1, dot(a, n)));
  const B = Math.max(-1, Math.min(1, dot(b, n)));
  const C = Math.max(-1, Math.min(1, dot(a, b)));
  const first: [number, number] = [(1 + A) / 2, (1 - A) / 2];
  const second: [number, number] = [(1 + B) / 2, (1 - B) / 2];
  const independent: Vec3 = [
    first[0] * second[0],
    first[0] * second[1] + first[1] * second[0],
    first[1] * second[1],
  ];
  const symmetric: Vec3 = [
    (1 + A) * (1 + B) / (3 + C),
    (1 + C - 2 * A * B) / (3 + C),
    (1 - A) * (1 - B) / (3 + C),
  ];
  return { first, second, independent, symmetric, separation: Math.acos(C) };
}
