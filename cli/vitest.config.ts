import { defineConfig } from "vitest/config";

export default defineConfig({
  // Stop Vite from walking up to the Next.js app's postcss.config.mjs.
  css: { postcss: {} },
});
