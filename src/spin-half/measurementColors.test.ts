import { describe, expect, it } from "vitest";
import { MEASURE_COLORS, measurementColors } from "./measurementColors";

describe("measurement colour blending", () => {
  it("preserves principal-axis palettes for either sign", () => {
    for (const [axis, palette] of [
      [[1, 0, 0], MEASURE_COLORS.x],
      [[0, 1, 0], MEASURE_COLORS.y],
      [[0, 0, 1], MEASURE_COLORS.z],
    ] as const) {
      expect(measurementColors([...axis])).toEqual(palette);
      expect(measurementColors([-axis[0], -axis[1], -axis[2]])).toEqual(palette);
    }
  });
  it("equally blends x and z halfway between them", () => {
    const colors = measurementColors([Math.SQRT1_2, 0, Math.SQRT1_2]);
    for (const i of [0, 1] as const) {
      for (const shift of [16, 8, 0]) {
        expect((colors[i] >> shift) & 255).toBe(Math.round(
          (((MEASURE_COLORS.x[i] >> shift) & 255) + ((MEASURE_COLORS.z[i] >> shift) & 255)) / 2,
        ));
      }
    }
  });
});
