import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { formatNumber } from "../shared/complex";
import { measurementColors } from "../spin-half/measurementColors";
import { Vec3 } from "../spin-one/physics";
import { pairAmplitudes, pairProbabilities } from "../spin-one-pair/probabilities";
import { orderingMarkup, orderingSceneMarkup, renderOrdering, signedPatchColors } from "./orderings";

const gold = "#ffb347";
const purple = "#ce85ff";
const cssColor = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const percent = (value: number) => `${formatNumber(100 * value, 2)}%`;
const sceneVector = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);
const examples = [
  { degrees: 0, title: "Along z: mixed outcomes survive", explanation: "Each sphere lies on one side of the plane. Only the mixed rows contribute." },
  { degrees: 30, title: "30° from z: partial interference", explanation: "The plane cuts both spheres. Opposing mixed contributions partly cancel; matching contributions reinforce." },
  { degrees: 90, title: "Along x: mixed outcomes cancel", explanation: "The plane bisects both spheres. Mixed arrows cancel exactly; ++ and −− reinforce." },
];

function renderSpheres(container: HTMLElement, axis: Vec3) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "Fixed +z and -z offset spheres, mirrored anti-state wire spheres, and measurement plane perpendicular to the white arrow.");
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  camera.position.set(2.7, 1.4, 3.8);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.addEventListener("change", () => renderer.render(scene, camera));
  for (const [sign, color] of [[1, gold], [-1, purple]] as const) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }));
    sphere.position.y = sign / 2;
    scene.add(sphere);
    const anti = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16),
      new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.11, depthWrite: false }));
    anti.position.y = -sign / 2;
    scene.add(anti);
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, sign, 0), new THREE.Vector3(), 1, color, 0.1, 0.045));
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({ color: 0x9caec8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sceneVector(axis));
  scene.add(plane);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry),
    new THREE.LineBasicMaterial({ color: 0x9caec8, transparent: true, opacity: 0.45 }));
  outline.quaternion.copy(plane.quaternion);
  scene.add(outline);
  scene.add(new THREE.ArrowHelper(sceneVector(axis), new THREE.Vector3(), 1.35, 0xffffff, 0.12, 0.05));
  new ResizeObserver(() => {
    const size = container.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    renderer.render(scene, camera);
  }).observe(container);
}

function amplitudeDiagram(ab: number, ba: number, total: number, label: string) {
  const x = (value: number) => 175 + 150 * value;
  const arrow = (start: number, end: number, y: number, color: string) => {
    if (Math.abs(end - start) < 1e-12) return `<circle cx="${x(start)}" cy="${y}" r="3" fill="${color}"/>`;
    const direction = Math.sign(end - start);
    return `<path d="M ${x(start)} ${y} H ${x(end)}" stroke="${color}" stroke-width="3"/>
      <path d="M ${x(end) - 7 * direction} ${y - 4} L ${x(end)} ${y} L ${x(end) - 7 * direction} ${y + 4}" fill="none" stroke="${color}" stroke-width="2"/>`;
  };
  return `<svg viewBox="0 0 350 96" role="img" aria-label="${label}: first contribution ${ab}, exchanged contribution ${ba}, sum ${total}">
    <path d="M 25 75 H 325 M 175 8 V 78" stroke="#424b5b" stroke-width="1"/>
    <text x="20" y="90">−1</text><text x="171" y="90">0</text><text x="315" y="90">+1</text>
    ${arrow(0, ab, 20, gold)}${arrow(ab, total, 40, purple)}${arrow(0, total, 62, "#ffffff")}
  </svg>`;
}

function projectionDiagram(theta: number) {
  const origin = [90, 180];
  const tip = [90, 40];
  const projection = [90 + 140 * Math.cos(theta) * Math.sin(theta), 180 - 140 * Math.cos(theta) ** 2];
  const nEnd = [90 + 155 * Math.sin(theta), 180 - 155 * Math.cos(theta)];
  return `<svg viewBox="0 0 350 220" role="img" aria-label="Unit z vector resolved into longitudinal component cos theta and transverse component sin theta relative to measurement axis">
    <path d="M ${origin} L ${nEnd}" stroke="#677388" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M ${origin} L ${tip}" stroke="#ffffff" stroke-width="2"/>
    <path d="M ${origin} L ${projection}" stroke="${gold}" stroke-width="5"/>
    <path d="M ${projection} L ${tip}" stroke="${purple}" stroke-width="4"/>
    <circle cx="90" cy="40" r="4" fill="white"/>
    <text x="68" y="30">+z</text><text x="${nEnd[0] + 8}" y="${nEnd[1] + 4}">n</text>
    <text x="185" y="35">cos θ = ${formatNumber(Math.cos(theta), 3)}</text>
    <text x="185" y="55">sin θ = ${formatNumber(Math.sin(theta), 3)}</text>
    <text x="20" y="205">Gold: longitudinal. Purple: transverse.</text>
  </svg>`;
}

for (const example of examples) {
  const theta = example.degrees * Math.PI / 180;
  const axis: Vec3 = [Math.sin(theta), 0, Math.cos(theta)];
  const a: Vec3 = [0, 0, 1];
  const b: Vec3 = [0, 0, -1];
  const cells = pairAmplitudes(a, b, axis);
  const probabilities = pairProbabilities(a, b, axis);
  const colors = measurementColors(axis);
  const outcomeColors = [cssColor(colors[0]), "#a0a0a0", cssColor(colors[1])];
  const card = document.createElement("article");
  card.className = "panel";
  card.innerHTML = `<h2>${example.title}</h2>
    <div class="sphere-example"></div>
    <p class="hint">White arrow: measurement axis n. Translucent square: measurement plane.
      Gold solid: +z state; purple solid: −z state. Opposite-colored wires: anti-states.</p>
    <p>${example.explanation}</p>
    <h3>1. Individual sphere predictions</h3>
    <p class="probabilities">+z star: +½ ${percent(probabilities.first[0])}, −½ ${percent(probabilities.first[1])}<br>
      −z star: +½ ${percent(probabilities.second[0])}, −½ ${percent(probabilities.second[1])}</p>
    <p class="hint">Mirroring with reversed labels duplicates these predictions; it does not specify their joint combination.</p>
    <h3>2. Locate the patches in each ordering</h3>
    <p class="hint">
      <span style="color:${signedPatchColors.plus}">Red: +|+n⟩</span> ·
      <span style="color:${signedPatchColors.minus}">Magenta: +|−n⟩</span> ·
      <span style="color:${signedPatchColors.negativeMinus}">Purple: −|−n⟩</span>.
      Here n is ${example.degrees === 90 ? "x" : example.degrees === 0 ? "z" : "30° from z"}.
      Colors show coefficient signs in our fixed basis convention; patch sizes still show probabilities.
      The leading minus is an amplitude phase, not a negative area.</p>
    <div class="ordering-comparison">
      ${orderingSceneMarkup(false)}
      ${orderingSceneMarkup(true)}
    </div>
    <p class="hint">Each view has two slots: left = slot 1, right = slot 2.
      The spheres are separated for readability, not physically displaced.
      Compare red/purple a with red/magenta b as the slots exchange.
      Purple patches encode the sign of a's negative-outcome coefficient, not a position-dependent phase within the patch.</p>
    <details>
      <summary>Show the ordering area products and amplitude calculations</summary>
    <p class="hint">Each square below represents a pair of patches, not their spatial intersection.
      Width = slot 1's area fraction; height = slot 2's area fraction.
      Its filled area gives the independent product. The signed amplitude below it supplies the arrow contribution.</p>
    ${orderingMarkup(theta, false)}
    ${orderingMarkup(theta, true)}
    </details>
    <p class="hint">Now align matching rows from ab and ba.
      Their positive areas do not cancel: their signed amplitudes can.
      The ±½ patch labels are spin outcomes, not amplitude signs.</p>
    <h3>3. Superimpose the contributions by outcome</h3>
    ${cells.map((cell, i) => {
      const label = ["++ → +1", "+− → 0", "−+ → 0", "−− → −1"][i];
      return `<strong>${label}</strong>${amplitudeDiagram(cell.ab.re, cell.ba.re, cell.total.re, label)}
        <p class="amplitude-equation">${formatNumber(cell.ab.re, 4)} + (${formatNumber(cell.ba.re, 4)}) = ${formatNumber(cell.total.re, 4)}; squared → ${percent(cell.probability)}</p>`;
    }).join("")}
    <h3>4. Final spin-1 probabilities</h3>
    <div class="result" role="img" aria-label="${probabilities.symmetric.map((p, i) => `P(${["+1", "0", "-1"][i]}) ${percent(p)}`).join(", ")}">
      ${probabilities.symmetric.map((p, i) => `<span style="width:${100 * p}%;background:${outcomeColors[i]}">${p > 0.05 ? ["+1", "0", "−1"][i] : ""}</span>`).join("")}
    </div>
    <p class="probabilities">+1: ${percent(probabilities.symmetric[0])} · 0: ${percent(probabilities.symmetric[1])} · −1: ${percent(probabilities.symmetric[2])}</p>
    <p class="hint">Independent products would give ${probabilities.independent.map(percent).join(" / ")} instead (+1 / 0 / −1).</p>
    <h3>5. Longitudinal vs. transverse geometry</h3>
    ${projectionDiagram(theta)}`;
  document.getElementById("examples")!.append(card);
  renderSpheres(card.querySelector<HTMLElement>(".sphere-example")!, axis);
  card.querySelectorAll<HTMLElement>(".ordering-scene").forEach((container) => {
    renderOrdering(container, axis, container.dataset.exchanged === "true");
  });
}
