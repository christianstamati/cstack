import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, lazyPlugins } from "vite-plus"

export default defineConfig({
  server: { port: 3000, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    // Builds for Vercel automatically when deployed there, Node otherwise.
    nitro({
      rolldownConfig: {
        onwarn(warning, warn) {
          // Libraries ship "use client" directives for RSC; harmless here.
          if (warning.code !== "MODULE_LEVEL_DIRECTIVE") warn(warning)
        },
      },
    }),
    viteReact(),
  ]),
})
