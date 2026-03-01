import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
// base is "/" in dev (serve) and "/dugout-dynasty/" in production builds (GitHub Pages)
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/dugout-dynasty/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
}));
