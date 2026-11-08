import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The interview backend (FastAPI, `npm run server`) runs on :8000.
    proxy: { "/api": "http://127.0.0.1:8000" },
    // Interview problems and reference solutions are server-only; the dev server must not serve them.
    fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/content/interview/**", "**/solutions/**", "**/server/**"] },
  },
});
