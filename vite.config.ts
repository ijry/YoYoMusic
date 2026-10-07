/// <reference types="vitest/config" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    /*
     * `scripts/` holds release tooling tested with the built-in `node:test`
     * runner, because it runs in the release job where no bundler is involved.
     * Vitest would otherwise collect those files and fail on `node:test` being
     * a built-in it cannot bundle. They are run by `npm run test:scripts`.
     */
    exclude: ["**/node_modules/**", "**/dist/**", "scripts/**"],
  },
});
