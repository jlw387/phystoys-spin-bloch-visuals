import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Vec3 } from "../spin-one/physics";

export function sphereOverlap(a: Vec3, b: Vec3) {
  const distance = Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2);
  // Equal radius-½ spheres: their surfaces cross on a circle of radius ½·sqrt(1 - d²).
  const rimRadius = 0.5 * Math.sqrt(Math.max(0, 1 - distance * distance));
  return {
    distance,
    separation: 2 * Math.asin(distance),
    volumeFraction: (2 + distance) * (1 - distance) ** 2 / 2,
    surfaceFraction: 1 - distance,
    rimRadius,
    rimDiskFraction: (rimRadius / 0.5) ** 2,
    quantumOverlapSquared: 1 - distance * distance,
  };
}

const toScene = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);

/** 2D slice through the plane containing both stars: lens shaded, rim disk seen edge-on as a chord. */
export function overlapSectionSvg(stars: [Vec3, Vec3]) {
  const [a, b] = stars;
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const perp = [b[0] - dot * a[0], b[1] - dot * a[1], b[2] - dot * a[2]];
  const sin = Math.hypot(perp[0], perp[1], perp[2]);
  const B = [sin, Math.max(-1, Math.min(1, dot))];
  const scale = 150;
  const X = (x: number) => 200 + scale * x;
  const Y = (y: number) => 205 - scale * y;
  const { distance, rimRadius } = sphereOverlap(a, b);
  const rim = distance > 1e-9 && rimRadius > 1e-9
    ? `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(B[0] / 2)}" y2="${Y((1 + B[1]) / 2)}" stroke="#ffffff" stroke-width="4"/>
       <text x="${X(B[0] / 4) + 10}" y="${Y((1 + B[1]) / 4) + 4}">rim disk, edge-on</text>`
    : "";
  return `<svg viewBox="0 0 400 400" role="img" aria-label="Cross-section through both stars: two circles, their shared lens, and the rim disk seen edge-on as a chord.">
    <defs><clipPath id="overlap-clip-a"><circle cx="${X(0)}" cy="${Y(0.5)}" r="${scale / 2}"/></clipPath></defs>
    <circle cx="${X(0)}" cy="${Y(0.5)}" r="${scale / 2}" fill="#ffb347" fill-opacity="0.12" stroke="#ffb347" stroke-width="2"/>
    <circle cx="${X(B[0] / 2)}" cy="${Y(B[1] / 2)}" r="${scale / 2}" fill="#ce85ff" fill-opacity="0.12" stroke="#ce85ff" stroke-width="2"/>
    <circle cx="${X(B[0] / 2)}" cy="${Y(B[1] / 2)}" r="${scale / 2}" fill="#54dfb2" fill-opacity="0.55" clip-path="url(#overlap-clip-a)"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(1)}" stroke="#ffb347" stroke-width="2"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(B[0])}" y2="${Y(B[1])}" stroke="#ce85ff" stroke-width="2"/>
    <text x="${X(0) - 14}" y="${Y(1) - 6}">a</text>
    <text x="${X(B[0]) + 6}" y="${Y(B[1]) + 4}">b</text>
    ${rim}
    <circle cx="${X(0)}" cy="${Y(0)}" r="3.5" fill="#ffffff"/>
    <text x="${X(0) - 18}" y="${Y(0) + 16}">origin</text>
  </svg>`;
}

export class OverlapScene {
  private scene = new THREE.Scene();
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  private controls: OrbitControls;
  private spheres = [0xffb347, 0xce85ff].map((color) => new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 64, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }),
  ));
  private caps = [0, 1].map(() => new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x54dfb2, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }),
  ));
  private arrows = [0xffb347, 0xce85ff].map((color) =>
    new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, color, 0.12, 0.05));
  private current: [Vec3, Vec3] | null = null;
  private isolated = false;
  private rimVisible = true;
  private rimDisk = new THREE.Mesh(new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  private rimCircle = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) =>
      new THREE.Vector3(Math.cos(2 * Math.PI * i / 128), Math.sin(2 * Math.PI * i / 128), 0))),
    new THREE.LineBasicMaterial({ color: 0xffffff }));
  private rimDiameter = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.04, gapSize: 0.03 }));

  constructor(private container: HTMLElement) {
    container.appendChild(this.renderer.domElement);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera.position.set(2.4, 1.6, 3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.scene.add(...this.spheres, ...this.caps, ...this.arrows, this.rimDisk, this.rimCircle, this.rimDiameter);
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xa0a0a0, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false })));
    const axes: [string, Vec3][] = [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]];
    for (const [name, axis] of axes) {
      const end = toScene(axis).multiplyScalar(1.2);
      this.scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([end.clone().negate(), end]),
        new THREE.LineBasicMaterial({ color: 0x737d8c, transparent: true, opacity: 0.45 }),
      ));
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#a0a0a0";
      ctx.font = "48px sans-serif";
      ctx.fillText(name, 12, 48);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
      label.position.copy(end).multiplyScalar(1.12);
      label.scale.setScalar(0.22);
      this.scene.add(label);
    }
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  setIsolated(isolated: boolean) {
    this.isolated = isolated;
    this.setStars(this.current);
  }

  setRimVisible(visible: boolean) {
    this.rimVisible = visible;
    this.setStars(this.current);
  }

  setStars(stars: [Vec3, Vec3] | null) {
    this.current = stars;
    this.spheres.forEach((sphere) => { sphere.visible = stars !== null && !this.isolated; });
    this.caps.forEach((cap) => { cap.visible = false; });
    this.arrows.forEach((arrow) => { arrow.visible = stars !== null; });
    for (const rim of [this.rimDisk, this.rimCircle, this.rimDiameter]) rim.visible = false;
    if (!stars) return;
    const centers = stars.map((star) => toScene(star).multiplyScalar(0.5));
    const { distance, rimRadius } = sphereOverlap(...stars);
    // The surfaces cross on a circle centred at (a+b)/4, perpendicular to a-b; it passes through the origin.
    if (this.rimVisible && distance > 1e-9 && rimRadius > 1e-9) {
      const center = centers[0].clone().add(centers[1]).multiplyScalar(0.5);
      const normal = centers[1].clone().sub(centers[0]).normalize();
      for (const rim of [this.rimDisk, this.rimCircle]) {
        rim.position.copy(center);
        rim.scale.setScalar(rimRadius);
        rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        rim.visible = true;
      }
      const tipMidpoint = center.clone().multiplyScalar(2);
      this.rimDiameter.geometry.setFromPoints([new THREE.Vector3(), tipMidpoint]);
      this.rimDiameter.computeLineDistances();
      this.rimDiameter.visible = true;
    }
    for (let i = 0; i < 2; i++) {
      this.spheres[i].position.copy(centers[i]);
      this.arrows[i].setDirection(toScene(stars[i]).normalize());
      const cap = this.caps[i];
      if (distance >= 1 - 1e-12 || (distance < 1e-12 && i === 1)) continue;
      cap.geometry.dispose();
      // The lens boundary consists of the inward-facing spherical caps, without planar faces.
      cap.geometry = new THREE.SphereGeometry(0.5, 96, 64, 0, 2 * Math.PI, 0,
        distance < 1e-12 ? Math.PI : Math.acos(distance));
      cap.position.copy(centers[i]);
      const towardOther = centers[1 - i].clone().sub(centers[i]);
      cap.quaternion.identity();
      if (distance >= 1e-12) {
        cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), towardOther.normalize());
      }
      cap.visible = true;
    }
  }

  private resize() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || w;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
