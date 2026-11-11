import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { formatNumber } from "../shared/complex";
import { buildSurfaceCap } from "../spin-half/surfaceSphere";
import { Vec3 } from "../spin-one/physics";

export const signedPatchColors = { plus: "#ff3333", minus: "#ff00ff", negativeMinus: "#9855e8" };
const toScene = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);
const labels = ["++", "+−", "−+", "−−"];

export function orderingContributions(theta: number, exchanged: boolean) {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  const a = [c, -s];
  const b = [s, c];
  const first = exchanged ? b : a;
  const second = exchanged ? a : b;
  return ([ [0, 0], [0, 1], [1, 0], [1, 1] ] as const).map(([i, j]) => ({
    first: first[i],
    second: second[j],
    firstProbability: first[i] ** 2,
    secondProbability: second[j] ** 2,
    contribution: first[i] * second[j] / Math.sqrt(2),
  }));
}

export function orderingSceneMarkup(exchanged: boolean) {
  const stars = exchanged ? ["b (−z)", "a (+z)"] : ["a (+z)", "b (−z)"];
  return `<section class="ordering">
    <h4>${exchanged ? "ba" : "ab"}: slot 1 = ${stars[0]}, slot 2 = ${stars[1]}</h4>
    <div class="ordering-scene" data-exchanged="${exchanged}"></div>
  </section>`;
}

export function orderingMarkup(theta: number, exchanged: boolean) {
  const name = exchanged ? "ba" : "ab";
  const stars = exchanged ? ["b (−z)", "a (+z)"] : ["a (+z)", "b (−z)"];
  const { plus, minus, negativeMinus } = signedPatchColors;
  return `<section class="ordering">
    <h4 class="${exchanged ? "purple" : "gold"}">${name}: slot 1 = ${stars[0]}, slot 2 = ${stars[1]}</h4>
    ${orderingContributions(theta, exchanged).map((cell, i) => {
      const firstSign = i < 2 ? "+" : "−";
      const secondSign = i % 2 === 0 ? "+" : "−";
      const firstColor = i < 2 ? plus : cell.first < 0 ? negativeMinus : minus;
      const secondColor = i % 2 === 0 ? plus : cell.second < 0 ? negativeMinus : minus;
      return `<div class="ordering-row">
        <svg viewBox="0 0 92 92" role="img" aria-label="${name}, ${labels[i]}: product-region fraction ${formatNumber(cell.firstProbability * cell.secondProbability, 4)}">
          <rect x="8" y="8" width="76" height="76" fill="#0e1117" stroke="#505968"/>
          <rect x="8" y="8" width="${76 * cell.firstProbability}" height="${76 * cell.secondProbability}" fill="${exchanged ? "#ce85ff" : "#ffb347"}" opacity="0.75"/>
        </svg>
        <div><strong>${labels[i]} → ${i === 0 ? "+1" : i === 3 ? "−1" : "0"}</strong>
          <div class="hint">Slot 1 <span style="color:${firstColor}">${firstSign}½</span> patch ×
            slot 2 <span style="color:${secondColor}">${secondSign}½</span> patch</div>
          <div class="hint">Area fractions: ${formatNumber(cell.firstProbability, 4)} × ${formatNumber(cell.secondProbability, 4)}</div>
          <div class="amplitude-equation">Amplitudes: (${formatNumber(cell.first, 4)}) × (${formatNumber(cell.second, 4)}) / √2
            = <strong class="${exchanged ? "purple" : "gold"}">${formatNumber(cell.contribution, 4)}</strong></div>
        </div>
      </div>`;
    }).join("")}
  </section>`;
}

export function renderOrdering(container: HTMLElement, axis: Vec3, exchanged: boolean) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", `${exchanged ? "ba" : "ab"} ordering: two labeled slots, with positive and negative measurement patches on each star sphere.`);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.set(0.8, 1.6, 6);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 12;
  controls.addEventListener("change", () => renderer.render(scene, camera));
  for (let slot = 0; slot < 2; slot++) {
    const isA = exchanged ? slot === 1 : slot === 0;
    const state: Vec3 = [0, 0, isA ? 1 : -1];
    const origin = new THREE.Vector3(slot === 0 ? -0.85 : 0.85, 0, 0);
    for (let outcome = 0; outcome < 2; outcome++) {
      const direction: Vec3 = outcome === 0 ? axis : [-axis[0], -axis[1], -axis[2]];
      const cap = buildSurfaceCap(state, direction, 48, 64);
      if (!cap) continue;
      const mesh = new THREE.Mesh(cap.geometry, new THREE.MeshBasicMaterial({
        color: outcome === 0 ? signedPatchColors.plus : isA ? signedPatchColors.negativeMinus : signedPatchColors.minus,
        side: THREE.DoubleSide,
      }));
      mesh.position.copy(origin);
      scene.add(mesh);
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ color: 0x9caec8, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    plane.position.copy(origin);
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toScene(axis));
    scene.add(plane);
    scene.add(new THREE.ArrowHelper(toScene(axis), origin, 1.2, 0xffffff, 0.09, 0.04));
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#e6e9ef";
    ctx.textAlign = "center";
    ctx.fillText(`Slot ${slot + 1}: ${isA ? "a (+z)" : "b (−z)"}`, 128, 40);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
    label.position.copy(origin).add(new THREE.Vector3(0, -1.3, 0));
    label.scale.set(1.45, 0.36, 1);
    scene.add(label);
  }
  new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }).observe(container);
}
