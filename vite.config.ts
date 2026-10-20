import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    target: "node20",
  },
  // For the page's tests: @react-three/fiber has no `exports` map, so Node would load its
  // CommonJS build, which `require`s three (deprecated). Prefer its ES module.
  ssr: { resolve: { mainFields: ["module", "main"] } },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [".github/BOOTSTRAP.md"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
