import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Vec3 } from "../spin-one/physics";
import { circleConstruction, Point2 } from "./distances";

const toScene = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);

export class DistanceScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private controls: OrbitControls;
  private geometry = new THREE.Group();
  private lastPerpendicular: THREE.Vector3 | null = null;

  constructor(private container: HTMLElement) {
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.setAttribute("aria-label", "Orbitable distance-product geometry with star spheres, measurement axis, projected tips A and B, and midpoint m.");
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.camera.position.set(3, 2, 3.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 10;
    this.controls.addEventListener("change", () => this.render());
    this.scene.add(this.geometry);
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  setState(stars: [Vec3, Vec3] | null, n: Vec3, colors: string[]) {
    this.geometry.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        if ("geometry" in object) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
          material.dispose();
        }
      }
    });
    this.geometry.clear();
    if (!stars) {
      this.render();
      return;
    }

    const { A, B, m, mn, mr, H, plus, minus } = circleConstruction(...stars, n);
    const axis = toScene(n);
    const midpoint = toScene(m);
    const projections = [axis.clone().multiplyScalar(A), axis.clone().multiplyScalar(B)];
    const origin = new THREE.Vector3();
    this.line(axis.clone().negate(), origin, colors[2]);
    this.line(origin, axis, colors[0]);
    this.point(axis.clone().negate(), colors[2], 0.025);
    this.point(axis, colors[0], 0.025);
    this.label("-n", axis.clone().multiplyScalar(-1.15), colors[2]);
    this.label("+n", axis.clone().multiplyScalar(1.15), colors[0]);

    stars.forEach((star, i) => {
      const color = i === 0 ? "#ffb347" : "#ce85ff";
      const tip = toScene(star);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 16),
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.09, depthWrite: false }),
      );
      sphere.position.copy(tip).multiplyScalar(0.5);
      this.geometry.add(sphere);
      this.line(origin, tip, color);
      this.line(tip, projections[i], color, true);
      this.line(midpoint, projections[i], "#a0a0a0");
      this.point(tip, color, 0.018);
      this.point(projections[i], color, i === 0 ? 0.032 : 0.022);
      this.label(i === 0 ? "A" : "B", projections[i].clone().add(new THREE.Vector3(-0.15, i === 0 ? 0.06 : -0.12, 0)), color);
    });

    this.line(origin, midpoint, "#ffffff", true);
    const foot = axis.clone().multiplyScalar(mn);
    this.line(midpoint, foot, "#ffa66b", true);
    this.line(foot, projections[0], "#63dfcf");
    this.label("dn", foot.clone().add(projections[0]).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, 0.1)), "#63dfcf");
    const centerB = toScene(stars[1]).multiplyScalar(0.5);
    const centerA = toScene(stars[0]).multiplyScalar(0.5);
    this.line(centerB, centerA, "#63dfcf");
    this.point(centerA, "#63dfcf", 0.016);
    this.point(centerB, "#63dfcf", 0.016);
    this.label("d", centerB.clone().lerp(centerA, 0.3).add(new THREE.Vector3(0.1, 0, 0)), "#63dfcf");

    // The 2D construction lives in the plane spanned by n and m's perpendicular part. When m ∥ n that plane is not
    // unique (e.g. opposite stars); reuse the previous plane so a continuous sweep doesn't make the circle jump.
    let perpendicular: THREE.Vector3;
    if (mr > 1e-6) {
      perpendicular = midpoint.clone().sub(foot).normalize();
    } else {
      const previous = this.lastPerpendicular?.clone().addScaledVector(axis, -this.lastPerpendicular.dot(axis));
      perpendicular = previous && previous.length() > 1e-3
        ? previous.normalize()
        : new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    }
    this.lastPerpendicular = perpendicular.clone();
    const lift = ([t, h]: Point2) => axis.clone().multiplyScalar(t).addScaledVector(perpendicular, h);
    if (H > 1e-9) {
      const circle = Array.from({ length: 129 }, (_, i) => {
        const angle = 2 * Math.PI * i / 128;
        return lift([mn + H * Math.cos(angle), mr + H * Math.sin(angle)]);
      });
      this.geometry.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circle), new THREE.LineBasicMaterial({ color: "#e6e9ef" })));
    }
    for (const [tangent, color] of [[plus, colors[0]], [minus, colors[2]]] as const) {
      const point = lift(tangent.point);
      this.line(lift(tangent.pole), point, color);
      this.line(midpoint, point, "#a0a0a0");
      this.point(point, "#e6e9ef", 0.014);
    }
    this.point(midpoint, "#ffffff", 0.026);
    this.label("m", midpoint.clone().add(new THREE.Vector3(0.12, 0.12, 0)), "#ffffff");
    this.render();
  }

  private line(from: THREE.Vector3, to: THREE.Vector3, color: string, dashed = false) {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.035, gapSize: 0.025, transparent: true, opacity: 0.65 })
      : new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), material);
    if (dashed) line.computeLineDistances();
    this.geometry.add(line);
  }

  private point(position: THREE.Vector3, color: string, radius: number) {
    const point = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ color }));
    point.position.copy(position);
    this.geometry.add(point);
  }

  private label(text: string, position: THREE.Vector3, color: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = color;
    context.font = "40px sans-serif";
    context.textAlign = "center";
    context.fillText(text, 64, 46);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), depthTest: false,
    }));
    label.position.copy(position);
    label.scale.set(0.32, 0.16, 1);
    this.geometry.add(label);
  }

  private resize() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || width;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }
}
