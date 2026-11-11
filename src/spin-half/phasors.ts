import { Complex, abs } from "../shared/complex";

const COLORS = { grid: "#2c3442", axis: "#8b95a7", input: "#e0a93b", norm: "#5aa9ff", text: "#8b95a7" };

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, dashed: boolean) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  if (Math.hypot(x1 - x0, y1 - y0) > 4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const MIN_EXTENT = 1.5;

/** Half-width of the plot in complex-plane units; grows only if a typed input is large. */
export function phasorExtent(input: Complex | null): number {
  return Math.max(MIN_EXTENT, input ? abs(input) * 1.15 : 0);
}

/**
 * Lets the user drag on an Argand canvas to set its complex value.
 * The scale is frozen at pointer-down so the plot doesn't rescale mid-drag.
 */
export function attachPhasorDrag(
  canvas: HTMLCanvasElement,
  getValue: () => Complex | null,
  onChange: (z: Complex, extent: number) => void,
) {
  let extent = MIN_EXTENT;
  let dragging = false;

  const toComplex = (e: PointerEvent): Complex => {
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * canvas.width;
    const py = ((e.clientY - r.top) / r.height) * canvas.height;
    const unit = (canvas.width / 2 - 14) / extent;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return { re: round((px - canvas.width / 2) / unit), im: round(-(py - canvas.height / 2) / unit) };
  };

  canvas.style.cursor = "crosshair";
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    extent = phasorExtent(getValue());
    canvas.setPointerCapture(e.pointerId);
    onChange(toComplex(e), extent);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragging) onChange(toComplex(e), extent);
  });
  const end = () => (dragging = false);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
}

/** Draws input (dashed) and normalized (solid) complex numbers on an Argand diagram. */
export function drawPhasor(canvas: HTMLCanvasElement, input: Complex | null, normalized: Complex | null, extentOverride?: number) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const extent = extentOverride ?? phasorExtent(input);
  const unit = (w / 2 - 14) / extent;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();

  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, unit, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.text;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("Re", w - 22, cy - 5);
  ctx.fillText("Im", cx + 5, 12);

  if (input) arrow(ctx, cx, cy, cx + input.re * unit, cy - input.im * unit, COLORS.input, true);
  if (normalized) arrow(ctx, cx, cy, cx + normalized.re * unit, cy - normalized.im * unit, COLORS.norm, false);
}
