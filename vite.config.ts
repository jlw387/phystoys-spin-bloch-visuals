import { defineConfig } from "vite";
import { resolve } from "node:path";

// Each particle/spin gets its own standalone HTML page.
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        spinHalf: resolve(__dirname, "spin-half.html"),
        spinOne: resolve(__dirname, "spin-one.html"),
        spinOneExperiment: resolve(__dirname, "spin-one-experiment.html"),
        paraboloidSweep: resolve(__dirname, "paraboloid-sweep.html"),
        spinOnePair: resolve(__dirname, "spin-one-pair.html"),
        spinOneInterference: resolve(__dirname, "spin-one-interference.html"),
        mobiusPairs: resolve(__dirname, "mobius-pairs.html"),
      },
    },
  },
});
