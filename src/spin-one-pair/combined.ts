import { Complex, formatComplex, formatNumber } from "../shared/complex";
import { measurementColors } from "../spin-half/measurementColors";
import { Vec3 } from "../spin-one/physics";
import { pairAmplitudes } from "./probabilities";

const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
export const outcomeColors = (axis: Vec3) => {
  const [plus, minus] = measurementColors(axis);
  return [css(plus), "#a0a0a0", css(minus)];
};

export function renderCombined(stars: [Vec3, Vec3] | null, axis: Vec3) {
  const tiles = document.getElementById("amplitude-tiles")!;
  const area = document.getElementById("combined-area")!;
  const legend = document.getElementById("combined-legend")!;
  tiles.replaceChildren();
  area.replaceChildren();
  legend.replaceChildren();
  if (!stars) {
    area.setAttribute("aria-label", "No probability areas: enter a valid nonzero state.");
    return;
  }
  const cells = pairAmplitudes(...stars, axis);
  const colors = outcomeColors(axis);
  const titles = ["++ → +1", "+− → 0", "−+ → 0", "−− → −1"];
  cells.forEach((cell, i) => {
    const tile = document.createElement("div");
    tile.className = "amplitude-tile";
    tile.style.borderColor = colors[i === 0 ? 0 : i === 3 ? 2 : 1];
    const title = document.createElement("strong");
    title.textContent = titles[i];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 260;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${titles[i]}: ${formatComplex(cell.ab)} + ${formatComplex(cell.ba)} = ${formatComplex(cell.total)}; probability ${formatNumber(cell.probability)}`);
    const ctx = canvas.getContext("2d")!;
    const origin = 130;
    const unit = 100;
    ctx.strokeStyle = "#505968";
    ctx.beginPath();
    ctx.moveTo(0, origin); ctx.lineTo(260, origin);
    ctx.moveTo(origin, 0); ctx.lineTo(origin, 260);
    ctx.stroke();
    ctx.fillStyle = "#8b95a7";
    ctx.font = "12px sans-serif";
    ctx.fillText("Re", 240, 123); ctx.fillText("Im", 136, 14);
    const arrow = (start: Complex, end: Complex, color: string, dashed = false) => {
      const x0 = origin + start.re * unit;
      const y0 = origin - start.im * unit;
      const x1 = origin + end.re * unit;
      const y1 = origin - end.im * unit;
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = color === "#ffffff" ? 5 : 2;
      ctx.setLineDash(dashed ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.setLineDash([]);
      if (Math.hypot(x1 - x0, y1 - y0) < 1e-8) return;
      const angle = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 8 * Math.cos(angle - 0.45), y1 - 8 * Math.sin(angle - 0.45));
      ctx.lineTo(x1 - 8 * Math.cos(angle + 0.45), y1 - 8 * Math.sin(angle + 0.45));
      ctx.closePath(); ctx.fill();
    };
    arrow({ re: 0, im: 0 }, cell.total, "#ffffff");
    arrow({ re: 0, im: 0 }, cell.ab, "#e0a93b");
    arrow(cell.ab, cell.total, "#ce85ff", true);
    const readout = document.createElement("div");
    readout.className = "readout";
    readout.textContent = `${formatComplex(cell.ab)} + (${formatComplex(cell.ba)}) = ${formatComplex(cell.total)}; P = ${formatNumber(cell.probability)}`;
    tile.append(title, canvas, readout);
    tiles.appendChild(tile);
  });
  const probabilities = [cells[0].probability, cells[1].probability + cells[2].probability, cells[3].probability];
  const names = ["+1", "0", "−1"];
  probabilities.forEach((p, i) => {
    const region = document.createElement("span");
    region.style.width = `${100 * p}%`;
    region.style.backgroundColor = colors[i];
    region.textContent = p > 0.06 ? `${names[i]}: ${formatNumber(100 * p, 1)}%` : "";
    region.title = `P(${names[i]}) = ${formatNumber(p, 6)}`;
    area.appendChild(region);
  });
  const description = `Measuring n = (${axis.map((v) => formatNumber(v)).join(", ")}): ${probabilities.map((p, i) => `P(${names[i]}) = ${formatNumber(p)}`).join("; ")}`;
  area.setAttribute("aria-label", description);
  legend.textContent = description;
}
