import { Complex, formatComplex, formatNumber, parseComplex } from "../shared/complex";
import { Analysis, analyze, outcomeProbabilities, sigmaUncertainties } from "./physics";
import { attachPhasorDrag, drawPhasor } from "./phasors";
import { BlochScene, MEASURE_COLORS } from "./scene";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const alphaIn = $<HTMLInputElement>("alpha");
const betaIn = $<HTMLInputElement>("beta");
const hbarBox = $<HTMLInputElement>("hbar-units");
const bloch = new BlochScene($("bloch"));

const PRESETS: [string, string, string][] = [
  ["|↑z⟩", "1", "0"],
  ["|↓z⟩", "0", "1"],
  ["|↑x⟩", "1/√2", "1/√2"],
  ["|↓x⟩", "1/√2", "-1/√2"],
  ["|↑y⟩", "1/√2", "i/√2"],
  ["|↓y⟩", "1/√2", "-i/√2"],
];
for (const [label, a, b] of PRESETS) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.addEventListener("click", () => {
    alphaIn.value = a;
    betaIn.value = b;
    resetExtents();
    update();
  });
  $("presets").appendChild(btn);
}

function tryParse(input: HTMLInputElement, errEl: HTMLElement): Complex | null {
  try {
    const z = parseComplex(input.value);
    input.classList.remove("invalid");
    errEl.textContent = "";
    return z;
  } catch (e) {
    input.classList.add("invalid");
    errEl.textContent = (e as Error).message;
    return null;
  }
}

function formatLength(norm: number): string {
  const n2 = norm * norm;
  const r = Math.round(n2);
  if (Math.abs(n2 - r) < 1e-9 && r > 0) {
    const root = Math.round(norm);
    return Math.abs(root * root - r) < 1e-9 ? String(root) : `√${r}`;
  }
  return formatNumber(norm);
}

function columnVector(top: string, bottom: string): string {
  return `<span class="colvec"><span>${top}</span><span>${bottom}</span></span>`;
}

function renderOutputs(a: Analysis | null, input: { alpha: Complex; beta: Complex } | null, hbar: boolean) {
  const norm = $("norm-out");
  const tbody = document.querySelector<HTMLTableSectionElement>("#exp-table tbody")!;
  const angles = $("angles-out");
  if (!a) {
    norm.textContent = tbody.innerHTML = angles.textContent = "";
    return;
  }
  const { alpha, beta } = a.normalized;
  const wrap = (z: Complex) => (z.im !== 0 && z.re !== 0 ? `(${formatComplex(z)})` : formatComplex(z));
  const factored = input
    ? `<div class="state-line">|ψ⟩ = <span class="frac"><span>1</span><span>${formatLength(a.norm)}</span></span>` +
      `${columnVector(wrap(input.alpha), wrap(input.beta))}</div>`
    : "";
  norm.innerHTML =
    factored +
    `<div class="state-line">&nbsp;&nbsp;&nbsp;= ${columnVector(formatComplex(alpha), formatComplex(beta))}</div>` +
    `‖ψ‖ = ${formatNumber(a.norm)}<br>` +
    `α = ${formatComplex(alpha)}<br>β = ${formatComplex(beta)}<br>` +
    `P(↑z) = ${formatNumber(a.probUp)}, P(↓z) = ${formatNumber(a.probDown)}`;

  const k = hbar ? 0.5 : 1;
  const unit = hbar ? " ħ" : "";
  const names = ["x", "y", "z"];
  tbody.innerHTML = names
    .map((n, i) => `<tr><td>${hbar ? "S" : "σ"}${n}</td><td>${formatNumber(a.sigma[i] * k)}${unit}</td></tr>`)
    .join("");

  const deg = (r: number) => formatNumber((r * 180) / Math.PI, 2);
  angles.innerHTML =
    `θ = ${formatNumber(a.theta)} rad (${deg(a.theta)}°)<br>` +
    `φ = ${formatNumber(a.phi)} rad (${deg(a.phi)}°)`;
}

function renderUncertainties(a: Analysis | null, hbar: boolean) {
  const bars = $("unc-bars");
  const rel = $("unc-rel");
  if (!a) {
    bars.innerHTML = rel.innerHTML = "";
    return;
  }
  const k = hbar ? 0.5 : 1;
  const unit = hbar ? " ħ" : "";
  const sym = hbar ? "S" : "σ";
  const d = sigmaUncertainties(a.sigma);
  const names = ["x", "y", "z"];
  bars.innerHTML = names
    .map(
      (n, i) =>
        `<div class="bar-row"><span class="bar-label">Δ${sym}${n}</span>` +
        `<span class="bar-track"><span class="bar-fill bar-${n}" style="width:${(d[i] * 100).toFixed(2)}%"></span></span>` +
        `<span class="bar-value">${formatNumber(d[i] * k)}${unit}</span></div>`,
    )
    .join("");

  // ΔAΔB ≥ ½|⟨[A,B]⟩| = k²|⟨σ_C⟩| for cyclic (A,B,C).
  const pairs: [number, number, number][] = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  const u2 = hbar ? " ħ²" : "";
  rel.innerHTML = pairs
    .map(([i, j, l]) => {
      const prod = d[i] * d[j] * k * k;
      const bound = Math.abs(a.sigma[l]) * k * k;
      return `Δ${sym}${names[i]}·Δ${sym}${names[j]} = ${formatNumber(prod)}${u2} ≥ ${formatNumber(bound)}${u2}`;
    })
    .join("<br>");
}

const frozenExtent: { alpha?: number; beta?: number } = {};

function bindDrag(key: "alpha" | "beta", canvasId: string, input: HTMLInputElement) {
  attachPhasorDrag(
    $<HTMLCanvasElement>(canvasId),
    () => {
      try {
        return parseComplex(input.value);
      } catch {
        return null;
      }
    },
    (z, extent) => {
      frozenExtent[key] = extent;
      input.value = formatComplex(z, 3);
      update();
    },
  );
}

const hexCss = (n: number) => "#" + n.toString(16).padStart(6, "0");
let measAxis: "x" | "y" | "z" = "z";
const measShow = $<HTMLInputElement>("meas-show");
const axisButtons: Record<string, HTMLButtonElement> = {};
for (const ax of ["x", "y", "z"] as const) {
  const btn = document.createElement("button");
  btn.textContent = ax;
  btn.addEventListener("click", () => {
    measAxis = ax;
    update();
  });
  axisButtons[ax] = btn;
  $("meas-axis").appendChild(btn);
}

function renderMeasurement(a: Analysis | null) {
  const tbody = document.querySelector<HTMLTableSectionElement>("#meas-table tbody")!;
  const check = $("meas-check");
  for (const ax of ["x", "y", "z"] as const) axisButtons[ax].classList.toggle("active", ax === measAxis);

  const fractions = bloch.setMeasurement(a && measShow.checked ? a.sigma : null, measShow.checked ? measAxis : null);
  if (!a) {
    tbody.innerHTML = check.innerHTML = "";
    return;
  }
  const dot = (c: number) => `<span class="dot" style="background:${hexCss(c)}"></span>`;
  tbody.innerHTML = (["x", "y", "z"] as const)
    .map((ax, i) => {
      const p = outcomeProbabilities(a.sigma[i]);
      const [pc, mc] = MEASURE_COLORS[ax];
      return (
        `<tr class="${ax === measAxis ? "sel" : ""}"><td>${ax}</td>` +
        `<td>${dot(pc)}${formatNumber(p[0])}</td><td>${dot(mc)}${formatNumber(p[1])}</td></tr>`
      );
    })
    .join("");

  if (fractions) {
    const i = ["x", "y", "z"].indexOf(measAxis);
    const p = outcomeProbabilities(a.sigma[i]);
    check.innerHTML =
      `Mesh surface-area ratio (+${measAxis}): ${formatNumber(fractions.plus)} vs P = ${formatNumber(p[0])}<br>` +
      `Mesh surface-area ratio (−${measAxis}): ${formatNumber(fractions.minus)} vs P = ${formatNumber(p[1])}`;
  } else {
    check.innerHTML = "";
  }
}

function update() {
  const alpha = tryParse(alphaIn, $("alpha-err"));
  const beta = tryParse(betaIn, $("beta-err"));
  const canvasA = $<HTMLCanvasElement>("phasor-alpha");
  const canvasB = $<HTMLCanvasElement>("phasor-beta");

  let analysis: Analysis | null = null;
  if (alpha && beta) {
    try {
      analysis = analyze({ alpha, beta });
      $("beta-err").textContent = "";
    } catch (e) {
      $("beta-err").textContent = (e as Error).message;
    }
  }

  drawPhasor(canvasA, alpha, analysis?.normalized.alpha ?? null, frozenExtent.alpha);
  drawPhasor(canvasB, beta, analysis?.normalized.beta ?? null, frozenExtent.beta);
  renderOutputs(analysis, alpha && beta ? { alpha, beta } : null, hbarBox.checked);
  renderUncertainties(analysis, hbarBox.checked);
  renderMeasurement(analysis);
  bloch.setState(analysis?.sigma ?? null, analysis?.norm ?? 1);
}

const resetExtents = () => {
  delete frozenExtent.alpha;
  delete frozenExtent.beta;
};
alphaIn.addEventListener("input", () => {
  delete frozenExtent.alpha;
  update();
});
betaIn.addEventListener("input", () => {
  delete frozenExtent.beta;
  update();
});
hbarBox.addEventListener("change", update);
measShow.addEventListener("change", update);

const toggleAll = $<HTMLButtonElement>("toggle-all");
const sections = () => Array.from(document.querySelectorAll<HTMLDetailsElement>("details.panel"));
toggleAll.addEventListener("click", () => {
  const open = sections().some((d) => d.open);
  sections().forEach((d) => (d.open = !open));
  toggleAll.textContent = open ? "Expand all" : "Collapse all";
});
const APPEARANCE_DEFAULTS = { wireColor: "#5aa9ff", wireOpacity: 0.06, fillColor: "#5aa9ff", fillOpacity: 0.04 };
const wireColor = $<HTMLInputElement>("wire-color");
const wireOpacity = $<HTMLInputElement>("wire-opacity");
const fillColor = $<HTMLInputElement>("fill-color");
const fillOpacity = $<HTMLInputElement>("fill-opacity");

function applyAppearance() {
  bloch.setWireStyle(wireColor.value, parseFloat(wireOpacity.value));
  bloch.setSurfaceStyle(fillColor.value, parseFloat(fillOpacity.value));
  $("wire-opacity-out").textContent = parseFloat(wireOpacity.value).toFixed(2);
  $("fill-opacity-out").textContent = parseFloat(fillOpacity.value).toFixed(2);
}
for (const el of [wireColor, wireOpacity, fillColor, fillOpacity]) el.addEventListener("input", applyAppearance);
$("appearance-reset").addEventListener("click", () => {
  wireColor.value = APPEARANCE_DEFAULTS.wireColor;
  wireOpacity.value = String(APPEARANCE_DEFAULTS.wireOpacity);
  fillColor.value = APPEARANCE_DEFAULTS.fillColor;
  fillOpacity.value = String(APPEARANCE_DEFAULTS.fillOpacity);
  applyAppearance();
});

bindDrag("alpha", "phasor-alpha", alphaIn);
bindDrag("beta", "phasor-beta", betaIn);
update();
