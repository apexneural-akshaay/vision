import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/devices":     "http://localhost:8000",
      "/cameras":     "http://localhost:8000",
      "/models":      "http://localhost:8000",
      "/deployments": "http://localhost:8000",
      "/stream":      "http://localhost:8000",
      "/health":      "http://localhost:8000",
    },
  },
});
