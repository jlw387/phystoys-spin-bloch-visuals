import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { formatNumber } from "../shared/complex";
import { measurementColors } from "../spin-half/measurementColors";
import { mobiusPoint, pairOutcome, pairToMobius, Point3, torusPoint } from "./geometry";

const first = "#ffb347";
const second = "#ce85ff";
const zero = 0xa0a0a0;
const TAU = 2 * Math.PI;
const ROWS = 360;
const COLS = 120;
const degrees = (angle: number) => `${formatNumber(((angle * 180 / Math.PI) % 360 + 360) % 360, 1)}°`;

const state = { alpha: 0.5, beta: 2.4, cut: Math.PI / 2 };

function cutColors() {
  return measurementColors([Math.cos(state.cut), Math.sin(state.cut), 0]);
}

function createView(container: HTMLElement, label: string, cameraPosition: Point3 = [0, 4.6, 5.6]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", label);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(...cameraPosition);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 1.8);
  light.position.set(2, 5, 3);
  scene.add(light);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 12;
  const render = () => renderer.render(scene, camera);
  controls.addEventListener("change", render);
  new ResizeObserver(() => {
    const size = container.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    render();
  }).observe(container);
  return { scene, render };
}

function surface(position: (s: number, t: number) => Point3) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= ROWS; i++) {
    for (let j = 0; j <= COLS; j++) positions.push(...position(i / ROWS, j / COLS));
  }
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const k = i * (COLS + 1) + j;
      indices.push(k, k + COLS + 1, k + 1, k + 1, k + COLS + 1, k + COLS + 2);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array(positions.length).fill(1), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function paint(geometry: THREE.BufferGeometry, pair: (s: number, t: number) => [number, number]) {
  const [plus, minus] = cutColors();
  const colors = { 1: new THREE.Color(plus), 0: new THREE.Color(zero), [-1]: new THREE.Color(minus) } as Record<number, THREE.Color>;
  const attribute = geometry.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i <= ROWS; i++) {
    for (let j = 0; j <= COLS; j++) {
      const [a, b] = pair(i / ROWS, j / COLS);
      const color = colors[pairOutcome(a, b, state.cut)];
      attribute.setXYZ(i * (COLS + 1) + j, color.r, color.g, color.b);
    }
  }
  attribute.needsUpdate = true;
}

const curve = (count: number, point: (s: number) => Point3) =>
  new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: count + 1 }, (_, i) => new THREE.Vector3(...point(i / count)))),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );

const marker = (color: string, radius = 0.09) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), new THREE.MeshBasicMaterial({ color }));
  mesh.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.45, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide })));
  return mesh;
};

const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

const torusView = createView(document.getElementById("torus-view")!,
  "Torus of ordered pairs, colored by outcome region, with markers for the pair and its swap.");
const torusPair = (s: number, t: number): [number, number] => [TAU * s, TAU * t];
const torusGeometry = surface((s, t) => torusPoint(...torusPair(s, t)));
torusView.scene.add(new THREE.Mesh(torusGeometry, material));
torusView.scene.add(curve(360, (s) => torusPoint(TAU * s, TAU * s)));
const torusMarkers = [marker(first), marker(second)];
torusView.scene.add(...torusMarkers);

const mobiusView = createView(document.getElementById("mobius-view")!,
  "Möbius strip of unordered pairs, colored by outcome region, with one marker for the pair.", [3.2, 3.4, 5.2]);
const mobiusPair = (s: number, t: number): [number, number] => {
  const u = TAU * s;
  const half = Math.acos(2 * t - 1);
  return [u / 2 - half, u / 2 + half];
};
const mobiusGeometry = surface((s, t) => mobiusPoint(TAU * s, 2 * t - 1));
mobiusView.scene.add(new THREE.Mesh(mobiusGeometry, material));
mobiusView.scene.add(curve(720, (s) => mobiusPoint(2 * TAU * s, 1)));
const mobiusMarker = marker("#ffffff", 0.1);
mobiusView.scene.add(mobiusMarker);

const circle = document.getElementById("pair-circle") as HTMLCanvasElement;
const ctx = circle.getContext("2d")!;
const SIZE = circle.width;
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.36;
const toCanvas = (angle: number, radius = RADIUS) => [CENTER + radius * Math.cos(angle), CENTER - radius * Math.sin(angle)];

function drawCircle() {
  const [plus, minus] = cutColors().map((color) => `#${color.toString(16).padStart(6, "0")}`);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineWidth = 6;
  // Canvas angles run clockwise, so negate the math-convention angles.
  for (const [center, color] of [[state.cut, plus], [state.cut + Math.PI, minus]] as const) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, -center - Math.PI / 2, -center + Math.PI / 2);
    ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#9caec8";
  ctx.setLineDash([6, 5]);
  const [x0, y0] = toCanvas(state.cut + Math.PI / 2, RADIUS * 1.25);
  const [x1, y1] = toCanvas(state.cut - Math.PI / 2, RADIUS * 1.25);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  const [nx, ny] = toCanvas(state.cut, RADIUS * 0.55);
  ctx.strokeStyle = ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(CENTER, CENTER); ctx.lineTo(nx, ny); ctx.stroke();
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("n", nx + 6, ny - 6);
  const p = toCanvas(state.alpha);
  const q = toCanvas(state.beta);
  ctx.strokeStyle = "#e6e9ef";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  for (const [[x, y], color, name] of [[p, first, "1"], [q, second, "2"]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = "#10141b";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(name, x - 3.5, y + 4);
  }
}

let paintedCut = Number.NaN;
function update() {
  if (state.cut !== paintedCut) {
    paint(torusGeometry, torusPair);
    paint(mobiusGeometry, mobiusPair);
    paintedCut = state.cut;
  }
  torusMarkers[0].position.set(...torusPoint(state.alpha, state.beta));
  torusMarkers[1].position.set(...torusPoint(state.beta, state.alpha));
  const { u, w } = pairToMobius(state.alpha, state.beta);
  mobiusMarker.position.set(...mobiusPoint(u, w));
  torusView.render();
  mobiusView.render();
  drawCircle();
  const outcome = pairOutcome(state.alpha, state.beta, state.cut);
  const coincident = Math.abs(Math.sin((state.alpha - state.beta) / 2)) < 1e-9;
  const torusText = coincident
    ? `(${degrees(state.alpha)}, ${degrees(state.beta)}) is its own swap: one point on the white diagonal.`
    : `<span style="color:${first}">(${degrees(state.alpha)}, ${degrees(state.beta)})</span> and
    <span style="color:${second}">(${degrees(state.beta)}, ${degrees(state.alpha)})</span> are two different points.`;
  document.getElementById("pair-readout")!.innerHTML =
    `Point 1 at ${degrees(state.alpha)}, point 2 at ${degrees(state.beta)}.<br>
    Torus: ${torusText}<br>
    Möbius strip: one point, u = ${degrees(u)}, w = ${formatNumber(w, 3)}${Math.abs(Math.abs(w) - 1) < 1e-9 ? " (on the edge)" : ""}.<br>
    Cut outcome: <strong>${outcome === 1 ? "++ → +1" : outcome === -1 ? "−− → −1" : "mixed → 0"}</strong>`;
  document.getElementById("cut-out")!.textContent = degrees(state.cut);
}

let dragging: "alpha" | "beta" | null = null;
const angleAt = (event: PointerEvent) => {
  const box = circle.getBoundingClientRect();
  const x = (event.clientX - box.left) * SIZE / box.width - CENTER;
  const y = CENTER - (event.clientY - box.top) * SIZE / box.height;
  return Math.atan2(y, x);
};
circle.addEventListener("pointerdown", (event) => {
  const angle = angleAt(event);
  const distance = (other: number) => Math.abs(Math.atan2(Math.sin(angle - other), Math.cos(angle - other)));
  dragging = distance(state.alpha) <= distance(state.beta) ? "alpha" : "beta";
  state[dragging] = angle;
  circle.setPointerCapture(event.pointerId);
  update();
});
circle.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  state[dragging] = angleAt(event);
  update();
});
circle.addEventListener("pointerup", () => { dragging = null; });

document.getElementById("swap")!.addEventListener("click", () => {
  [state.alpha, state.beta] = [state.beta, state.alpha];
  update();
});
document.getElementById("coincide")!.addEventListener("click", () => {
  state.beta = state.alpha;
  update();
});
const cutInput = document.getElementById("cut") as HTMLInputElement;
cutInput.addEventListener("input", () => {
  state.cut = Number(cutInput.value) * Math.PI / 180;
  update();
});
state.cut = Number(cutInput.value) * Math.PI / 180;
update();
