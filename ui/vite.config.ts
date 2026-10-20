// Builds the town page into dist/ui, next to the bundled CLI that serves it.
// Run from the repo root: `vp build ui` (the `build:ui` script).
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Relative asset paths: the page is served from `/` by the town server, and the
  // built files load without the session token (see src/town/server.ts).
  base: "./",
  build: {
    outDir: "../dist/ui",
    emptyOutDir: true,
    // three.js alone is ~700 kB minified; one chunk is fine for a local page.
    chunkSizeWarningLimit: 1500,
  },
});
