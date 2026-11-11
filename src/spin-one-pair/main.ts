import { observeState } from "../spin-one/main";
import { majoranaStars, outcomeProbabilities } from "../spin-one/physics";
import { Complex, formatComplex, formatNumber, parseComplex } from "../shared/complex";
import { attachPhasorDrag, drawPhasor } from "../spin-half/phasors";
import { BlochScene } from "../spin-half/scene";
import { pairProbabilities } from "./probabilities";
import { outcomeColors, renderCombined } from "./combined";
import { OverlapScene, overlapSectionSvg, sphereOverlap } from "./overlap";
import { renderDistancePanel } from "./distances";
import { DistanceScene } from "./distanceScene";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = ["a", "b", "c"] as const;
const inputs = keys.map((key) => $<HTMLInputElement>(`amp-${key}`));
const canvases = keys.map((key) => $<HTMLCanvasElement>(`phasor-${key}`));
const extents: (number | undefined)[] = [undefined, undefined, undefined];
const scenes = [new BlochScene($("star-a")), new BlochScene($("star-b"))];
const overlapScene = new OverlapScene($("overlap-view"));
const distanceScene = new DistanceScene($("distance-view"));
const separationInputs = [$<HTMLInputElement>("overlap-separation"), $<HTMLInputElement>("distance-separation")];
const separationOutputs = [$("overlap-separation-out"), $("distance-separation-out")];
const overlapPresets: [string, [string, string, string]][] = [
  ["Coincident: full overlap", ["1", "0", "0"]],
  ["60° apart: large overlap", ["sqrt(6)", "1", "0"]],
  ["+z and +x: 90° apart", ["sqrt(2)", "1", "0"]],
  ["120° apart: small overlap", ["sqrt(2)", "sqrt(3)", "0"]],
  ["Opposite: touching only", ["0", "1", "0"]],
  ["30°/150° toward +y", ["1", "2*sqrt(2)*i", "-1"]],
  ["30°/150° opposite y", ["1", "-sqrt(6)*i", "1"]],
];
function setInputs(values: [string, string, string]) {
  values.forEach((value, i) => { inputs[i].value = value; extents[i] = undefined; });
  inputs[0].dispatchEvent(new Event("input"));
}
overlapPresets.forEach(([label, values]) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => setInputs(values));
  $("overlap-presets").appendChild(button);
});
separationInputs.forEach((input) => input.addEventListener("input", () => {
  const halfAngle = Number(input.value) * Math.PI / 360;
  setInputs([String(Math.SQRT2 * Math.cos(halfAngle)), String(Math.sin(halfAngle)), "0"]);
}));
$("overlap-isolate").addEventListener("change", () =>
  overlapScene.setIsolated($<HTMLInputElement>("overlap-isolate").checked));
$("overlap-rim").addEventListener("change", () =>
  overlapScene.setRimVisible($<HTMLInputElement>("overlap-rim").checked));
let draggingInput = false;

scenes.forEach((scene, i) => {
  const key = i === 0 ? "a" : "b";
  const container = $(`star-${key}-appearance`);
  container.innerHTML =
    `<label>Wire color <input type="color" id="${key}-wire-color" value="#a0a0a0" /></label>` +
    `<label>Wire opacity <input type="range" id="${key}-wire-opacity" min="0" max="1" step="0.01" value="0" /><output id="${key}-wire-out">0</output></label>` +
    `<label>Surface color <input type="color" id="${key}-fill-color" value="#a0a0a0" /></label>` +
    `<label>Surface opacity <input type="range" id="${key}-fill-opacity" min="0" max="1" step="0.01" value="0.03" /><output id="${key}-fill-out">0.03</output></label>` +
    `<button type="button" id="${key}-appearance-reset">Reset</button>` +
    `<p class="hint">Reference sphere only; measurement surfaces retain the shared axis colours.</p>`;
  const wireColor = $<HTMLInputElement>(`${key}-wire-color`);
  const wireOpacity = $<HTMLInputElement>(`${key}-wire-opacity`);
  const fillColor = $<HTMLInputElement>(`${key}-fill-color`);
  const fillOpacity = $<HTMLInputElement>(`${key}-fill-opacity`);
  const apply = () => {
    scene.setWireStyle(wireColor.value, Number(wireOpacity.value));
    scene.setSurfaceStyle(fillColor.value, Number(fillOpacity.value));
    $(`${key}-wire-out`).textContent = Number(wireOpacity.value).toFixed(2);
    $(`${key}-fill-out`).textContent = Number(fillOpacity.value).toFixed(2);
  };
  [wireColor, wireOpacity, fillColor, fillOpacity].forEach((input) => input.addEventListener("input", apply));
  $(`${key}-appearance-reset`).addEventListener("click", () => {
    wireColor.value = fillColor.value = "#a0a0a0";
    wireOpacity.value = "0.04";
    fillOpacity.value = "0.03";
    apply();
  });
  apply();
});

function readInput(i: number): Complex | null {
  try {
    return parseComplex(inputs[i].value);
  } catch {
    // The shared spin-1 input handler reports the parse error beside this input.
    return null;
  }
}

canvases.forEach((canvas, i) => {
  inputs[i].addEventListener("input", () => {
    if (!draggingInput) {
      extents[i] = undefined;
      drawPhasor(canvas, readInput(i), currentComponents[i]);
    }
  });
  attachPhasorDrag(canvas, () => readInput(i), (value, extent) => {
    inputs[i].value = formatComplex(value, 3);
    extents[i] = extent;
    draggingInput = true;
    try {
      inputs[i].dispatchEvent(new Event("input"));
    } finally {
      draggingInput = false;
    }
  });
});
let currentComponents: (Complex | null)[] = [null, null, null];

observeState((state, axis) => {
  const principal = axis[2] > 1 - 1e-10 ? "z" : axis[0] > 1 - 1e-10 ? "x" : axis[1] > 1 - 1e-10 ? "y" : null;
  document.querySelectorAll<HTMLButtonElement>("#axis-presets button").forEach((button) => {
    button.classList.toggle("active", button.textContent === principal);
    button.setAttribute("aria-pressed", String(button.textContent === principal));
  });
  currentComponents = keys.map((_, i) => state?.[i] ?? null);
  canvases.forEach((canvas, i) => drawPhasor(canvas, readInput(i), currentComponents[i], extents[i]));
  const body = document.querySelector<HTMLTableSectionElement>("#pair-table tbody")!;
  if (!state) {
    overlapScene.setStars(null);
    $("overlap-section").innerHTML = "";
    $("overlap-readout").textContent = "Enter a valid nonzero state to display sphere overlap.";
    separationOutputs.forEach((output) => { output.textContent = "—"; });
    renderCombined(null, axis);
    renderDistancePanel(null, axis, outcomeColors(axis));
    distanceScene.setState(null, axis, outcomeColors(axis));
    scenes.forEach((scene, i) => {
      scene.setState(null, 1);
      scene.setMeasurement(null, null);
      $(`star-${i === 0 ? "a" : "b"}-readout`).textContent = "";
    });
    body.innerHTML = "";
    $("pair-status").textContent = "Enter a valid nonzero state to show the two stars and their probabilities.";
    return;
  }
  const stars = majoranaStars(state);
  overlapScene.setStars(stars);
  $("overlap-section").innerHTML = overlapSectionSvg(stars);
  const overlap = sphereOverlap(...stars);
  const degrees = overlap.separation * 180 / Math.PI;
  separationInputs.forEach((input) => { input.value = String(degrees); });
  separationOutputs.forEach((output) => { output.textContent = `${formatNumber(degrees, 2)}°`; });
  $("overlap-readout").textContent =
    `Star separation: ${formatNumber(degrees, 2)}°. Center distance: ${formatNumber(overlap.distance)}. ` +
    `Lens volume / one sphere volume: ${formatNumber(100 * overlap.volumeFraction, 2)}%. ` +
    `Lens surface area / one sphere area: ${formatNumber(100 * overlap.surfaceFraction, 2)}%. ` +
    `Rim disk area / sphere cross-section: ${formatNumber(100 * overlap.rimDiskFraction, 2)}%. ` +
    `Quantum overlap |⟨a|b⟩|²: ${formatNumber(overlap.quantumOverlapSquared)}.`;
  renderCombined(stars, axis);
  const colors = outcomeColors(axis);
  renderDistancePanel(stars, axis, colors);
  distanceScene.setState(stars, axis, colors);
  document.querySelectorAll<HTMLElement>("#prob-bars .bar-fill").forEach((bar, i) => {
    bar.style.backgroundColor = colors[i];
  });
  const pair = pairProbabilities(stars[0], stars[1], axis);
  scenes.forEach((scene, i) => {
    scene.setState(stars[i], 1);
    const mesh = scene.setMeasurement(stars[i], principal ?? axis)!;
    const probabilities = i === 0 ? pair.first : pair.second;
    $(`star-${i === 0 ? "a" : "b"}-readout`).textContent =
      `Direction: (${stars[i].map((v) => formatNumber(v)).join(", ")}). ` +
      `P(+½) = ${formatNumber(probabilities[0])}; P(−½) = ${formatNumber(probabilities[1])}. ` +
      `Mesh area fractions: ${formatNumber(mesh.plus)}, ${formatNumber(mesh.minus)}.`;
  });
  const exact = outcomeProbabilities(state, axis);
  const names = ["+1 (++)", "0 (+− or −+)", "−1 (−−)"];
  body.innerHTML = names.map((name, i) =>
    `<tr><td>${name}</td><td>${formatNumber(pair.independent[i])}</td><td>${formatNumber(pair.symmetric[i])}</td><td>${formatNumber(exact[i])}</td><td>${formatNumber(pair.independent[i] - exact[i])}</td></tr>`,
  ).join("");
  $("pair-status").textContent = `Star separation: ${formatNumber(pair.separation * 180 / Math.PI, 2)}°. ` +
    `Maximum independent-pair discrepancy: ${formatNumber(Math.max(...exact.map((p, i) => Math.abs(p - pair.independent[i]))))}.`;
});
