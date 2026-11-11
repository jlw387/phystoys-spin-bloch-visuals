export const MEASURE_COLORS = {
  x: [0xff3b3b, 0xff3bff],
  y: [0x3bd63b, 0xffe03b],
  z: [0x3b6bff, 0x3be0ff],
} as const;

/** Squared direction components give continuous, sign-independent RGB blend weights. */
export function measurementColors(axis: [number, number, number]): [number, number] {
  const weights = axis.map((v) => v * v);
  const total = weights.reduce((sum, v) => sum + v, 0);
  const palettes = [MEASURE_COLORS.x, MEASURE_COLORS.y, MEASURE_COLORS.z];
  const blend = (outcome: 0 | 1) => {
    let color = 0;
    for (const shift of [16, 8, 0]) {
      const channel = palettes.reduce((sum, palette, i) =>
        sum + ((palette[outcome] >> shift) & 255) * weights[i] / total, 0);
      color |= Math.round(channel) << shift;
    }
    return color;
  };
  return [blend(0), blend(1)];
}
