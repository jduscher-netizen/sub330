import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Lokal: API über "wrangler pages dev" auf Port 8788
    proxy: { "/api": "http://localhost:8788" },
  },
});
