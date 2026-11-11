import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildSurfaceCap } from "./surfaceSphere";
import { MEASURE_COLORS, measurementColors } from "./measurementColors";
export { MEASURE_COLORS } from "./measurementColors";

const AXIS_COLORS = { x: 0xff5c5c, y: 0x5cd65c, z: 0x5c8dff };

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

/**
 * Bloch sphere. Physics frame (x, y, z) maps to three.js (x, z, y) with z up
 * in physics terms drawn as the screen-vertical axis, keeping a right-handed frame.
 */
export class BlochScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  private controls: OrbitControls;
  private stateArrow: THREE.ArrowHelper;
  private ghostArrow: THREE.ArrowHelper;
  private measGroup = new THREE.Group();
  private fillMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.04, depthWrite: false }),
  );
  private wireMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x5aa9ff, wireframe: true, transparent: true, opacity: 0.06 }),
  );

  /** Colour (CSS hex string) and opacity (0–1) of the sphere's wire mesh. */
  setWireStyle(color: string, opacity: number) {
    const m = this.wireMesh.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    m.opacity = opacity;
    this.wireMesh.visible = opacity > 0;
  }

  /** Colour (CSS hex string) and opacity (0–1) of the sphere's translucent surface. */
  setSurfaceStyle(color: string, opacity: number) {
    const m = this.fillMesh.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    m.opacity = opacity;
    this.fillMesh.visible = opacity > 0;
  }

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(2.6, 1.8, 3.2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;

    this.scene.add(this.fillMesh, this.wireMesh);

    this.addAxis("x", new THREE.Vector3(1, 0, 0));
    this.addAxis("y", new THREE.Vector3(0, 1, 0));
    this.addAxis("z", new THREE.Vector3(0, 0, 1));

    this.stateArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0xffffff, 0.15, 0.08);
    this.ghostArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0xe0a93b, 0.15, 0.08);
    (this.ghostArrow.line.material as THREE.LineBasicMaterial).transparent = true;
    (this.ghostArrow.line.material as THREE.LineBasicMaterial).opacity = 0.4;
    (this.ghostArrow.cone.material as THREE.MeshBasicMaterial).transparent = true;
    (this.ghostArrow.cone.material as THREE.MeshBasicMaterial).opacity = 0.4;
    this.scene.add(this.stateArrow, this.ghostArrow, this.measGroup);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.animate();
  }

  private toScene(v: [number, number, number]): THREE.Vector3 {
    // physics (x, y, z) -> three (x, z, -y): right-handed with physics z vertical.
    return new THREE.Vector3(v[0], v[2], -v[1]);
  }

  private addAxis(name: "x" | "y" | "z", dir: THREE.Vector3) {
    const color = AXIS_COLORS[name];
    const phys: [number, number, number] = [dir.x, dir.y, dir.z];
    const d = this.toScene(phys);
    const geo = new THREE.BufferGeometry().setFromPoints([d.clone().multiplyScalar(-1.25), d.clone().multiplyScalar(1.25)]);
    this.scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
    const label = makeLabel(name, "#" + color.toString(16).padStart(6, "0"));
    label.position.copy(d.clone().multiplyScalar(1.45));
    this.scene.add(label);
  }

  /** `sigma` is the unit Bloch vector; `inputNorm` is the length of the unnormalized input. */
  setState(sigma: [number, number, number] | null, inputNorm: number) {
    this.stateArrow.visible = this.ghostArrow.visible = sigma !== null;
    if (!sigma) return;
    const dir = this.toScene(sigma).normalize();
    this.stateArrow.setDirection(dir);
    this.stateArrow.setLength(1, 0.15, 0.08);
    this.ghostArrow.setDirection(dir);
    const len = Math.max(inputNorm, 0.05);
    this.ghostArrow.setLength(len, Math.min(0.15, len * 0.5), 0.08);
    this.ghostArrow.visible = Math.abs(len - 1) > 1e-6;
  }

  /**
   * Shows the offset state sphere split by the measurement plane through the origin,
   * or hides it when `axis` is null. Returns the curved mesh area fractions.
   */
  setMeasurement(sigma: [number, number, number] | null, axis: "x" | "y" | "z" | [number, number, number] | null): { plus: number; minus: number } | null {
    for (const child of [...this.measGroup.children]) {
      this.measGroup.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    if (!sigma || !axis) return null;

    const n: [number, number, number] = typeof axis !== "string" ? axis : axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
    const [plusColor, minusColor] = typeof axis === "string" ? MEASURE_COLORS[axis] : measurementColors(axis);
    const fractions = { plus: 0, minus: 0 };
    const parts: [number, number, "plus" | "minus"][] = [
      [1, plusColor, "plus"],
      [-1, minusColor, "minus"],
    ];
    for (const [sign, color, key] of parts) {
      const cap = buildSurfaceCap(sigma, [n[0] * sign, n[1] * sign, n[2] * sign]);
      if (!cap) continue;
      fractions[key] = cap.areaFraction;
      this.measGroup.add(
        new THREE.Mesh(
          cap.geometry,
          new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
        ),
      );
    }
    return fractions;
  }

  private resize() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 400;
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
