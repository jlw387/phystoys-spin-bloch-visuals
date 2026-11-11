import { Complex, c, formatComplex, formatNumber, parseComplex } from "../shared/complex";
import { State, Vec3, expectation, majoranaStars, normalize, outcomeProbabilities, uncertainties } from "./physics";
import { SpinOneScene } from "./scene";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const scene = new SpinOneScene($("bloch"));
const ids = ["a", "b", "c"] as const;
const inputs = ids.map((k) => $<HTMLInputElement>(`amp-${k}`));

const PRESETS: [string, [string, string, string]][] = [
  ["m=+1 (z)", ["1", "0", "0"]],
  ["m=0 (z)", ["0", "1", "0"]],
  ["m=−1 (z)", ["0", "0", "1"]],
  ["m=+1 (x)", ["1", "sqrt(2)", "1"]],
  ["m=0 (x)", ["1", "0", "-1"]],
  ["m=0 (y)", ["1", "0", "1"]],
  ["(1, i, 0)/√2", ["1", "i", "0"]],
];
const AXES: [string, number, number][] = [
  ["z", 0, 0],
  ["x", 90, 0],
  ["y", 90, 90],
];
const FIELDS = [
  ["P(+1|n) = Q(n)", 0],
  ["P(0|n)", 1],
  ["P(−1|n)", 2],
] as const;

let state: State | null = null;
let fieldIndex = 0;
const amplitudeToggle = document.querySelector<HTMLInputElement>("#husimi-amplitude");
let stateListener: ((state: State | null, axis: Vec3) => void) | null = null;

export function observeState(listener: (state: State | null, axis: Vec3) => void) {
  stateListener = listener;
  listener(state, axisVector());
}

function button(label: string, onClick: () => void, container: HTMLElement): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  container.appendChild(b);
  return b;
}

for (const [label, vals] of PRESETS) {
  button(label, () => {
    vals.forEach((v, i) => (inputs[i].value = v));
    update();
  }, $("presets"));
}

const thetaIn = $<HTMLInputElement>("axis-theta");
const phiIn = $<HTMLInputElement>("axis-phi");
for (const [label, th, ph] of AXES) {
  button(`${label}`, () => {
    thetaIn.value = String(th);
    phiIn.value = String(ph);
    update();
  }, $("axis-presets"));
}
const fieldButtons = FIELDS.map(([label, i]) =>
  button(label, () => {
    fieldIndex = i;
    update();
  }, $("field-presets")),
);

const axisVector = (): Vec3 => {
  const t = (Number(thetaIn.value) * Math.PI) / 180;
  const p = (Number(phiIn.value) * Math.PI) / 180;
  return [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
};

const wrap = (z: Complex) => (z.im !== 0 && z.re !== 0 ? `(${formatComplex(z)})` : formatComplex(z));
const colvec = (items: string[]) => `<span class="colvec">${items.map((s) => `<span>${s}</span>`).join("")}</span>`;

function parseInputs(): Complex[] | null {
  let ok = true;
  const vals = inputs.map((el, i) => {
    const err = $(`err-${ids[i]}`);
    try {
      const z = parseComplex(el.value);
      el.classList.remove("invalid");
      err.textContent = "";
      return z;
    } catch (e) {
      el.classList.add("invalid");
      err.textContent = (e as Error).message;
      ok = false;
      return c(0);
    }
  });
  return ok ? vals : null;
}

function renderState(raw: Complex[] | null, norm: number | null) {
  const out = $("norm-out");
  if (!raw || norm === null || !state) {
    out.innerHTML = raw ? "State has zero length." : "";
    return;
  }
  out.innerHTML =
    `<div class="state-line">|ψ⟩ = <span class="frac"><span>1</span><span>${formatNumber(norm)}</span></span>${colvec(raw.map(wrap))}</div>` +
    `<div class="state-line">&nbsp;&nbsp;&nbsp;= ${colvec(state.map((z) => formatComplex(z)))}</div>` +
    `‖ψ‖ = ${formatNumber(norm)}`;
}

function renderExpectations() {
  const tbody = document.querySelector<HTMLTableSectionElement>("#exp-table tbody")!;
  if (!state) {
    tbody.innerHTML = "";
    $("exp-len").textContent = "";
    return;
  }
  const e = expectation(state);
  const d = uncertainties(state);
  tbody.innerHTML = ["x", "y", "z"]
    .map((n, i) => `<tr><td>S<sub>${n}</sub></td><td>${formatNumber(e[i])}</td><td>${formatNumber(d[i])}</td></tr>`)
    .join("");
  $("exp-len").textContent = `|⟨S⟩| = ${formatNumber(Math.hypot(...e))} ħ`;
}

function renderProbabilities() {
  const box = $("prob-bars");
  const t = Number(thetaIn.value);
  const p = Number(phiIn.value);
  $("axis-theta-out").textContent = `${t}°`;
  $("axis-phi-out").textContent = `${p}°`;
  if (!state) {
    box.innerHTML = "";
    return;
  }
  const probs = outcomeProbabilities(state, axisVector());
  const names = ["+1", "0", "−1"];
  const classes = ["bar-z", "bar-y", "bar-x"];
  box.innerHTML = probs
    .map(
      (v, i) =>
        `<div class="bar-row"><span class="bar-label">m=${names[i]}</span>` +
        `<span class="bar-track"><span class="bar-fill ${classes[i]}" style="width:${(v * 100).toFixed(2)}%"></span></span>` +
        `<span class="bar-value">${formatNumber(v, 3)}</span></div>`,
    )
    .join("");
}

function update() {
  const raw = parseInputs();
  const n = raw ? normalize(raw as State) : null;
  state = n ? n.state : null;
  renderState(raw, n ? n.norm : null);
  renderExpectations();
  renderProbabilities();
  stateListener?.(state, axisVector());
  const amplitude = amplitudeToggle?.checked ?? false;
  fieldButtons.forEach((b, i) => {
    b.classList.toggle("active", i === fieldIndex);
    b.setAttribute("aria-pressed", String(i === fieldIndex));
  });
  $<HTMLInputElement>("inflate").disabled = amplitude;
  scene.setAxis(axisVector());
  const scale = $("field-scale");
  if (!state) {
    scene.setStars([]);
    scene.setExpectation([0, 0, 0]);
    scene.setField(() => 0, false);
    scale.textContent = "";
    return;
  }
  const psi = state;
  const fixed = $<HTMLInputElement>("fixed-scale").checked;
  scene.setField((dir) => outcomeProbabilities(psi, dir)[fieldIndex], $<HTMLInputElement>("inflate").checked, fixed, amplitude);
  scene.setStars(majoranaStars(psi));
  scene.setExpectation(expectation(psi));
  const fieldName = ["Q = P(+1|n)", "P(0|n)", "P(−1|n)"][fieldIndex];
  scale.textContent = (amplitude ? `Radius = sqrt(${fieldName}), unscaled; colour = ${fieldName}. ` : "") + (fixed
    ? `colour scale: dark = 0, yellow = 1 (fixed); maximum over the sphere = ${formatNumber(scene.maxValue, 3)}`
    : `colour scale: dark = 0, yellow = ${formatNumber(scene.maxValue, 3)} (maximum over the sphere)`);
}

inputs.forEach((el) => el.addEventListener("input", update));
thetaIn.addEventListener("input", update);
phiIn.addEventListener("input", update);
$("inflate").addEventListener("change", update);
$("fixed-scale").addEventListener("change", update);
amplitudeToggle?.addEventListener("change", update);

const toggleAll = $<HTMLButtonElement>("toggle-all");
toggleAll.addEventListener("click", () => {
  const panels = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.panel"));
  const anyOpen = panels.some((d) => d.open);
  panels.forEach((d) => (d.open = !anyOpen));
  toggleAll.textContent = anyOpen ? "Expand all" : "Collapse all";
});

update();
