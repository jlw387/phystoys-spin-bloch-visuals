import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Vec3 } from "../spin-one/physics";
import { BoundaryType, Sample, boundaryHeight, measurementFrame } from "./geometry";

export const COLORS = [0x5c8dff, 0x5cd65c, 0xff5c5c];
const toScene = (p: Vec3) => new THREE.Vector3(p[0], p[2], -p[1]);

export class ExperimentScene {
  private scene = new THREE.Scene();
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  private controls: OrbitControls;
  private dynamic = new THREE.Group();

  constructor(container: HTMLElement) {
    container.appendChild(this.renderer.domElement);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera.position.set(2.8, 1.9, 3.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.scene.add(this.dynamic);
    const reference = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.06, depthWrite: false }));
    this.scene.add(reference);
    const axes: [string, Vec3, number][] = [["x", [1, 0, 0], COLORS[2]], ["y", [0, 1, 0], COLORS[1]], ["z", [0, 0, 1], COLORS[0]]];
    for (const [name, axis, color] of axes) {
      const end = toScene(axis).multiplyScalar(1.3);
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([end.clone().negate(), end]), new THREE.LineBasicMaterial({ color })));
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.font = "48px sans-serif";
      ctx.fillText(name, 12, 48);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
      label.position.copy(end).multiplyScalar(1.12);
      label.scale.setScalar(0.25);
      this.scene.add(label);
    }
    const resize = () => {
      const w = container.clientWidth || 400;
      const h = container.clientHeight || w;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  update(samples: Sample[], axis: Vec3, preparation: Vec3, k: number, showBoundaries: boolean, boundary: BoundaryType = "paraboloid") {
    for (const child of [...this.dynamic.children]) {
      this.dynamic.remove(child);
      if (child instanceof THREE.Points || child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((m) => m.dispose());
      }
    }
    const positions: number[] = [];
    const colors: number[] = [];
    for (const sample of samples) {
      positions.push(...toScene(sample.position).toArray());
      const color = new THREE.Color(COLORS[sample.outcome]);
      colors.push(color.r, color.g, color.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.dynamic.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.012, vertexColors: true })));
    const axisEnd = toScene(axis).multiplyScalar(1.2);
    const prepEnd = toScene(preparation).multiplyScalar(1.1);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([axisEnd.clone().negate(), axisEnd]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.04 }));
    line.computeLineDistances();
    this.dynamic.add(line);
    this.dynamic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), prepEnd]), new THREE.LineBasicMaterial({ color: 0xffb347 })));
    if (!showBoundaries) return;
    const frame = measurementFrame(axis);
    const normal = new THREE.Vector3(...axis);
    for (const sign of [1, -1]) {
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= 24; i++) {
        for (let j = 0; j <= 64; j++) {
          const angle = j * 2 * Math.PI / 64;
          const cx = Math.cos(angle);
          const cy = Math.sin(angle);
          // Each boundary is quadratic in radius; clip its rim to the unit ball.
          const coefficient = boundaryHeight(cx, cy, k, boundary);
          const rMax = Math.sqrt(2 / (1 + Math.sqrt(1 + 4 * coefficient * coefficient)));
          const r = rMax * i / 24;
          const height = boundaryHeight(r * cx, r * cy, k, boundary);
          const p = frame.x.clone().multiplyScalar(r * cx).addScaledVector(frame.y, r * cy).addScaledVector(normal, sign * height);
          positions.push(...toScene([p.x, p.y, p.z]).toArray());
          if (i < 24 && j < 64) {
            const a = i * 65 + j;
            indices.push(a, a + 65, a + 1, a + 1, a + 65, a + 66);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      this.dynamic.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: sign > 0 ? COLORS[0] : COLORS[2], side: THREE.DoubleSide, transparent: true, opacity: 0.12, depthWrite: false })));
    }
  }
}
