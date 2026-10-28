import { defineConfig } from "vite";
import { gui } from "@opencode/plugin/gui/vite";

export default defineConfig({ plugins: [gui({ entry: "src/gui.ts", outFile: "dist/gui-experimental.cjs" })] });
