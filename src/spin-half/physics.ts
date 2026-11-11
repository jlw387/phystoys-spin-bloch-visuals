import { Complex, abs2, arg, conj, mul, scale } from "../shared/complex";

export interface SpinHalfState {
  alpha: Complex;
  beta: Complex;
}

export interface Analysis {
  norm: number;
  normalized: SpinHalfState;
  /** ⟨σx⟩, ⟨σy⟩, ⟨σz⟩ of the normalized state (dimensionless, in [-1, 1]). */
  sigma: [number, number, number];
  theta: number;
  phi: number;
  probUp: number;
  probDown: number;
}

export function normalize(s: SpinHalfState): { norm: number; state: SpinHalfState } {
  const norm = Math.sqrt(abs2(s.alpha) + abs2(s.beta));
  if (norm === 0) throw new Error("The zero vector cannot be normalized");
  return { norm, state: { alpha: scale(s.alpha, 1 / norm), beta: scale(s.beta, 1 / norm) } };
}

/** Expectation values of σx, σy, σz for a normalized state. */
export function sigmaExpectations(s: SpinHalfState): [number, number, number] {
  const ab = mul(conj(s.alpha), s.beta);
  return [2 * ab.re, 2 * ab.im, abs2(s.alpha) - abs2(s.beta)];
}

/** P(+n), P(−n) along an axis with ⟨σₙ⟩ = s. */
export function outcomeProbabilities(s: number): [number, number] {
  return [(1 + s) / 2, (1 - s) / 2];
}

/** Δσᵢ = √(1 − ⟨σᵢ⟩²) since σᵢ² = I. */
export function sigmaUncertainties(sigma: [number, number, number]): [number, number, number] {
  const u = (s: number) => Math.sqrt(Math.max(0, 1 - s * s));
  return [u(sigma[0]), u(sigma[1]), u(sigma[2])];
}

export function analyze(s: SpinHalfState): Analysis {
  const { norm, state } = normalize(s);
  const sigma = sigmaExpectations(state);
  const theta = 2 * Math.atan2(Math.sqrt(abs2(state.beta)), Math.sqrt(abs2(state.alpha)));
  // Relative phase is undefined at the poles.
  const phi = abs2(state.alpha) === 0 || abs2(state.beta) === 0 ? 0 : arg(mul(conj(state.alpha), state.beta));
  return {
    norm,
    normalized: state,
    sigma,
    theta,
    phi,
    probUp: abs2(state.alpha),
    probDown: abs2(state.beta),
  };
}
