import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // same-origin requests in development, so the API needs no CORS setup
    proxy: { "/api": "http://localhost:4000" },
  },
});
