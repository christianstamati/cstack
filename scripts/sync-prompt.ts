// Copies .github/BOOTSTRAP.md into src/bootstrap-prompt.ts as a string constant.
// The Markdown file is the one to edit; run `bun run sync-prompt` afterwards.
// tests/bootstrap-prompt.test.ts fails when the two drift apart.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const markdown = readFileSync(join(root, ".github/BOOTSTRAP.md"), "utf8");

const escaped = markdown.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");

writeFileSync(
  join(root, "src/bootstrap-prompt.ts"),
  `// Generated from .github/BOOTSTRAP.md by scripts/sync-prompt.ts. Do not edit by hand.
// Must stay byte-identical to that file; tests/bootstrap-prompt.test.ts checks it.
export const BOOTSTRAP_PROMPT = \`${escaped}\`;
`,
);
