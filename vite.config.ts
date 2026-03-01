import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /dugout-dynasty/ when deployed to tomorroweyes.github.io
  base: process.env.GITHUB_ACTIONS ? "/dugout-dynasty/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
