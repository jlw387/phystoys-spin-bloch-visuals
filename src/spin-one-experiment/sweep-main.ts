import { Vec3 } from "../spin-one/physics";
import { Sample } from "./geometry";
import { ExperimentScene } from "./scene";
import { SWEEP_CURVATURE, excludedBySweep, inMiddleRegion } from "./sweep";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scene = new ExperimentScene($("sweep-view"));
const count = $<HTMLSelectElement>("sweep-count");
const only = $<HTMLInputElement>("survivors-only");
const whole = $<HTMLInputElement>("whole-ball");
const angle = $<HTMLInputElement>("sweep-angle");
const boundary = $<HTMLInputElement>("sweep-boundary");
const slice = $<HTMLCanvasElement>("slice");
const context = slice.getContext("2d")!;
const z: Vec3 = [0, 0, 1];
const grid: Vec3[] = [];
for (let i = -24; i <= 24; i++) {
  for (let j = -24; j <= 24; j++) {
    for (let l = -24; l <= 24; l++) {
      if (i * i + j * j + l * l <= 24 * 24) grid.push([i / 24, j / 24, l / 24]);
    }
  }
}

function update() {
  const n = count.value === "all" ? null : Number(count.value);
  const phi = Number(angle.value) * Math.PI / 180;
  const axis: Vec3 = [Math.cos(phi), Math.sin(phi), 0];
  $("sweep-angle-out").textContent = `${angle.value}°`;
  const samples: Sample[] = [];
  let candidates = 0;
  let survivors = 0;
  for (const p of grid) {
    if (!whole.checked && !inMiddleRegion(p, z)) continue;
    candidates++;
    const excluded = excludedBySweep(p, n);
    if (!excluded) survivors++;
    if (!excluded || !only.checked) samples.push({ position: p, outcome: excluded ? 2 : 0 });
  }
  scene.update(samples, axis, z, SWEEP_CURVATURE, boundary.checked);
  $("sweep-status").textContent = n === null
    ? "ALL axes: allowed region is exactly empty. The swept middle regions cover every point."
    : `${survivors.toLocaleString()} of ${candidates.toLocaleString()} displayed-grid candidates survive ${n} axis/axes. This is a grid count, not a probability.`;

  const image = context.createImageData(slice.width, slice.height);
  for (let row = 0; row < slice.height; row++) {
    for (let col = 0; col < slice.width; col++) {
      const x = 2 * (col + 0.5) / slice.width - 1;
      const y = 1 - 2 * (row + 0.5) / slice.height;
      const excluded = excludedBySweep([x, y, 0], n);
      const visible = x * x + y * y <= 1 && (!only.checked || !excluded);
      const color = visible ? excluded ? [255, 92, 92] : [92, 141, 255] : [14, 17, 23];
      const offset = (row * slice.width + col) * 4;
      image.data.set([...color, 255], offset);
    }
  }
  context.putImageData(image, 0, 0);
}

count.addEventListener("change", update);
[only, whole, boundary].forEach((input) => input.addEventListener("change", update));
angle.addEventListener("input", update);
update();
