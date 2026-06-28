import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

export default defineConfig({
  plugins: [viteSingleFile()],
  root: "src/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        widget: path.resolve(__dirname, "src/ui/widget.html"),
      },
    },
  },
});
