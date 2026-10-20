// Copies .github/<file>.md into src/<out>.ts as a string constant.
// The Markdown files are the ones to edit; run `bun run sync-prompt` afterwards.
// The tests fail when the two drift apart.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function sync(source: string, out: string, constant: string, test: string): void {
  const markdown = readFileSync(join(root, ".github", source), "utf8");
  const escaped = markdown.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
  writeFileSync(
    join(root, "src", out),
    `// Generated from .github/${source} by scripts/sync-prompt.ts. Do not edit by hand.
// Must stay byte-identical to that file; ${test} checks it.
export const ${constant} = \`${escaped}\`;
`,
  );
}

sync("BOOTSTRAP.md", "bootstrap-prompt.ts", "BOOTSTRAP_PROMPT", "tests/bootstrap-prompt.test.ts");
sync("TOWN.md", "town-prompt.ts", "TOWN_PROMPT", "tests/town-prompt.test.ts");
