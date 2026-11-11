import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Vec3 } from "./physics";

const AXIS_COLORS = { x: 0xff5c5c, y: 0x5cd65c, z: 0x5c8dff };
const STOPS = [
  [0.267, 0.005, 0.329],
  [0.231, 0.322, 0.546],
  [0.128, 0.567, 0.551],
  [0.369, 0.789, 0.383],
  [0.993, 0.906, 0.144],
].map((s) => new THREE.Color(s[0], s[1], s[2]));

export function colormap(t: number, out = new THREE.Color()): THREE.Color {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], x - i);
}

function makeLabel(text: string, color: string): THREE.Sprite {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  g.fillStyle = color;
  g.font = "bold 80px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 68);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
  sprite.scale.setScalar(0.3);
  return sprite;
}

// physics (x, y, z) -> three (x, z, -y)
const toScene = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);

/** Sphere of directions coloured by a scalar field, with Majorana stars, ⟨S⟩ and a measurement axis. */
export class SpinOneScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  private controls: OrbitControls;
  private geo = new THREE.SphereGeometry(1, 96, 64);
  private base: Float32Array;
  private mesh: THREE.Mesh;
  private wire: THREE.Mesh;
  private stars = new THREE.Group();
  private starLink: THREE.Line;
  private expArrow: THREE.ArrowHelper;
  private axisGroup = new THREE.Group();
  private plusMarker: THREE.Mesh;
  private minusMarker: THREE.Mesh;
  private axisLine: THREE.Line;
  private values: Float32Array;
  maxValue = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.camera.position.set(2.8, 1.9, 3.4);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;

    const count = this.geo.attributes.position.count;
    this.base = (this.geo.attributes.position.array as Float32Array).slice();
    this.values = new Float32Array(count);
    this.geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.08 }),
    );
    this.scene.add(this.mesh, this.wire);

    for (const [name, v] of [
      ["x", [1, 0, 0]],
      ["y", [0, 1, 0]],
      ["z", [0, 0, 1]],
    ] as const) {
      const d = toScene(v as unknown as Vec3);
      const color = AXIS_COLORS[name];
      this.scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([d.clone().multiplyScalar(-1.4), d.clone().multiplyScalar(1.4)]),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
        ),
      );
      const label = makeLabel(name, "#" + color.toString(16).padStart(6, "0"));
      label.position.copy(d.multiplyScalar(1.6));
      this.scene.add(label);
    }

    this.starLink = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    this.expArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0xffffff, 0.12, 0.07);
    const marker = (color: number) => new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    this.plusMarker = marker(0xffffff);
    this.minusMarker = marker(0x888888);
    this.axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.04 }));
    this.axisGroup.add(this.plusMarker, this.minusMarker, this.axisLine);
    this.scene.add(this.stars, this.starLink, this.expArrow, this.axisGroup);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.animate();
  }

  /** Colour the sphere by field(n); optionally push the surface out in proportion to the value. */
  setField(field: (n: Vec3) => number, inflate: boolean, fixedScale = false, amplitudeSurface = false) {
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const col = this.geo.attributes.color as THREE.BufferAttribute;
    let max = 1e-12;
    for (let i = 0; i < pos.count; i++) {
      const bx = this.base[3 * i];
      const by = this.base[3 * i + 1];
      const bz = this.base[3 * i + 2];
      const v = field([bx, -bz, by]);
      this.values[i] = v;
      if (v > max) max = v;
    }
    this.maxValue = max;
    const top = fixedScale ? 1 : max;
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = this.values[i] / top;
      colormap(t, tmp);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      const r = amplitudeSurface ? Math.sqrt(Math.max(0, this.values[i])) : inflate ? 0.12 + 0.88 * t : 1;
      pos.setXYZ(i, this.base[3 * i] * r, this.base[3 * i + 1] * r, this.base[3 * i + 2] * r);
    }
    pos.needsUpdate = col.needsUpdate = true;
    this.wire.visible = !inflate && !amplitudeSurface;
    this.geo.computeBoundingSphere();
  }

  setStars(stars: Vec3[]) {
    this.stars.clear();
    stars.forEach((s) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff9f1c, depthTest: false }));
      m.renderOrder = 2;
      m.position.copy(toScene(s).multiplyScalar(1.03));
      this.stars.add(m);
    });
    const [a, b] = stars.map((s) => toScene(s).multiplyScalar(1.03));
    if (!a || !b) {
      this.starLink.visible = false;
      return;
    }
    this.starLink.geometry.setFromPoints([a, b]);
    this.starLink.visible = a.distanceTo(b) > 1e-4;
  }

  setExpectation(s: Vec3) {
    const len = Math.hypot(...s);
    this.expArrow.visible = len > 1e-6;
    if (len <= 1e-6) return;
    this.expArrow.setDirection(toScene(s).normalize());
    this.expArrow.setLength(len, Math.min(0.12, len), 0.07);
  }

  setAxis(n: Vec3) {
    const p = toScene(n).multiplyScalar(1.2);
    this.plusMarker.position.copy(p);
    this.minusMarker.position.copy(p.clone().multiplyScalar(-1));
    this.axisLine.geometry.setFromPoints([p, p.clone().multiplyScalar(-1)]);
    this.axisLine.computeLineDistances();
  }

  private resize() {
    const w = this.renderer.domElement.parentElement!.clientWidth;
    const h = this.renderer.domElement.parentElement!.clientHeight || w;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
