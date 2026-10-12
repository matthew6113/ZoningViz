import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so a build works from any folder (GitHub Pages serves it under /ZoningViz/).
  base: "./",
});
