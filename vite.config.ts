import { defineConfig } from "vite-plus"

// Workspace-wide format, lint and staged-file settings. `vp check` reads them
// from here in every package. The web app's Vite config is in apps/web.
export default defineConfig({
  fmt: {
    semi: false,
    printWidth: 80,
    trailingComma: "es5",
    sortImports: {},
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: "packages/ui/src/styles/globals.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/convex/_generated/**",
      "**/components.json",
      // Biome never formatted Markdown; keep the hand-written tables compact.
      "**/*.md",
    ],
    overrides: [
      {
        // Vendored from shadcn: keep their class order so updates diff cleanly.
        files: ["packages/ui/src/components/**"],
        options: { sortTailwindcss: false },
      },
    ],
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
    categories: {
      correctness: "error",
    },
    jsPlugins: [
      "@shadcn/lint",
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    options: {
      reportUnusedDisableDirectives: "error",
      typeAware: true,
      typeCheck: true,
    },
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/convex/_generated/**",
      // Variant files only type-check inside a generated project, where
      // `bun run --cwd cli verify` checks them.
      "cli/template/**",
    ],
    settings: {
      shadcn: {
        ui: "@workspace/ui/components",
      },
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      // Design system: style components through their variants, theme tokens
      // and the spacing scale. Changing these is a design decision.
      "shadcn/no-restyle": [
        "error",
        {
          allow: ["layout"],
          contracts: [
            {
              pattern: "^Card$|(Content|Header|Footer)$",
              allow: ["layout", "spacing"],
            },
          ],
        },
      ],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-inline-styles": "error",
      "shadcn/no-unknown-classes": "error",
      "shadcn/require-static-classes": "error",
    },
    overrides: [
      {
        files: ["packages/ui/src/components/**"],
        rules: {
          "shadcn/no-restyle": "off",
          "shadcn/no-arbitrary-values": "off",
          "shadcn/require-static-classes": "off",
          "shadcn/no-unknown-classes": ["error", { allow: ["toaster"] }],
          "jsx-a11y/label-has-associated-control": "off",
        },
      },
      {
        files: ["apps/web/src/components/**"],
        rules: {
          "unicorn/filename-case": ["error", { case: "pascalCase" }],
        },
      },
    ],
  },
  staged: {
    "*": "vp check --fix --no-error-on-unmatched-pattern",
  },
})
