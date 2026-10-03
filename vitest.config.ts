import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
  // The Next.js PostCSS config breaks Vite when tests import app modules.
  css: { postcss: {} },
});
