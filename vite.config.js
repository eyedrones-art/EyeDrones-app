import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // il worker della mappa 3D (MapLibre) è un modulo ES
  worker: { format: "es" },
});
