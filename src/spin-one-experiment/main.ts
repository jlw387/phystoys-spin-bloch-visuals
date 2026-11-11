import { observeState } from "../spin-one/main";
import { State, Vec3, outcomeProbabilities } from "../spin-one/physics";
import { formatComplex, formatNumber, parseComplex } from "../shared/complex";
import { BoundaryType, Outcome, direction, inferPreparation, preparedState, sampleShape } from "./geometry";
import { ExperimentScene, COLORS } from "./scene";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scene = new ExperimentScene($("experiment-view"));
const prepTheta = $<HTMLInputElement>("prep-theta");
const prepPhi = $<HTMLInputElement>("prep-phi");
const curvature = $<HTMLInputElement>("curvature");
const curvatureInput = $<HTMLInputElement>("curvature-input");
const radius = $<HTMLInputElement>("zero-radius");
const zeroShape = $<HTMLSelectElement>("zero-shape");
const show = $<HTMLInputElement>("show-paraboloids");
const boundarySelect = $<HTMLSelectElement>("boundary-type");
let state: State | null = null;
let axis: Vec3 = [0, 0, 1];
let prepared: Outcome = 0;
const preparation = () => direction(Number(prepTheta.value) * Math.PI / 180, Number(prepPhi.value) * Math.PI / 180);
const names = ["+1", "0", "−1"];
const buttons: HTMLButtonElement[] = [];

function prepare() {
  const psi = preparedState(Number(prepTheta.value) * Math.PI / 180, Number(prepPhi.value) * Math.PI / 180, prepared);
  ["a", "b", "c"].forEach((key, i) => {
    $<HTMLInputElement>(`amp-${key}`).value = formatComplex(psi[i], 12);
  });
  $("amp-a").dispatchEvent(new Event("input"));
}

function update() {
  const boundary = boundarySelect.value as BoundaryType;
  const inferred = state ? inferPreparation(state, preparation()) : null;
  if (inferred) {
    const [x, y, z] = inferred.axis;
    prepTheta.value = String(Math.acos(Math.max(-1, Math.min(1, z))) * 180 / Math.PI);
    prepPhi.value = String((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
  }
  $("prep-theta-out").textContent = `${formatNumber(Number(prepTheta.value), 2)}°`;
  $("prep-phi-out").textContent = `${formatNumber(Number(prepPhi.value), 2)}°`;
  $("zero-radius-out").textContent = radius.value;
  const s = preparation();
  const body = document.querySelector<HTMLTableSectionElement>("#comparison tbody")!;
  let k: number;
  try {
    const value = parseComplex(curvatureInput.value);
    if (value.im !== 0 || value.re < Number(curvature.min)) {
      throw new Error("Curvature must be a finite real number of at least 0.05.");
    }
    k = value.re;
    curvature.max = String(Math.max(Number(curvature.max), k));
    curvature.value = String(k);
    $("curvature-out").textContent = String(k);
    $("curvature-error").textContent = "";
    curvatureInput.classList.remove("invalid");
    curvatureInput.setAttribute("aria-invalid", "false");
  } catch (error) {
    $("curvature-error").textContent = (error as Error).message;
    curvatureInput.classList.add("invalid");
    curvatureInput.setAttribute("aria-invalid", "true");
    $("curvature-out").textContent = "Invalid";
    $("geometry-status").textContent = "Enter a valid curvature to display the experimental geometry.";
    body.innerHTML = "";
    scene.update([], axis, s, 0, false);
    return;
  }
  const match = inferred?.outcome ?? -1;
  buttons.forEach((b, i) => b.classList.toggle("active", i === match));
  if (!state || match === -1) {
    body.innerHTML = "";
    $("geometry-status").textContent = !state ? "Enter a valid nonzero state to compare." : "No sphere or disk/ring shape is defined for this general superposition. Rotated ±1 and 0 eigenstates are detected automatically; use a corresponding preset or Prepare button.";
    scene.update([], axis, s, k, show.checked, boundary);
    return;
  }
  const m = match as Outcome;
  prepared = m;
  const result = sampleShape(s, m, zeroShape.value === "ring" ? "ring" : "disk", Number(radius.value), axis, k, 20000, boundary);
  const quantum = outcomeProbabilities(state, axis);
  body.innerHTML = names.map((name, i) => `<tr><td><span class="dot" style="background:#${COLORS[i].toString(16).padStart(6, "0")}"></span>${name}</td><td>${formatNumber(result.fractions[i], 4)}</td><td>${formatNumber(quantum[i], 4)}</td><td>${formatNumber(result.fractions[i] - quantum[i], 4)}</td></tr>`).join("");
  const angle = Math.acos(Math.max(-1, Math.min(1, s[0] * axis[0] + s[1] * axis[1] + s[2] * axis[2]))) * 180 / Math.PI;
  $("geometry-status").textContent = `Prepared m=${names[m]}; angle between axes ${formatNumber(angle, 1)}°. Shape: ${m === 1 ? zeroShape.value : "offset sphere"}. Maximum probability discrepancy: ${formatNumber(Math.max(...quantum.map((p, i) => Math.abs(p - result.fractions[i]))), 4)}.`;
  scene.update(result.samples, axis, s, k, show.checked, boundary);
}

names.forEach((name, i) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `Prepare ${name}`;
  button.addEventListener("click", () => { prepared = i as Outcome; prepare(); });
  $("prepare-buttons").appendChild(button);
  buttons.push(button);
});
prepTheta.addEventListener("input", prepare);
prepPhi.addEventListener("input", prepare);
$("husimi-intermediate").addEventListener("click", () => {
  ["sqrt(2)", "1", "0"].forEach((value, i) => {
    $<HTMLInputElement>(`amp-${["a", "b", "c"][i]}`).value = value;
  });
  $("amp-a").dispatchEvent(new Event("input"));
});
curvature.addEventListener("input", () => {
  curvatureInput.value = curvature.value;
  update();
});
[curvatureInput, radius].forEach((input) => input.addEventListener("input", update));
[zeroShape, show, boundarySelect].forEach((input) => input.addEventListener("change", update));
observeState((psi, n) => { state = psi; axis = n; update(); });
