// Generated from .github/TOWN.md by scripts/sync-prompt.ts. Do not edit by hand.
// Must stay byte-identical to that file; tests/town-prompt.test.ts checks it.
export const TOWN_PROMPT = `# Town mode

This section overrides the Phase 1 rule about asking questions in the terminal. The
user is not answering in the terminal. They are in a 3D town in their browser, and each
answer drops a building into it. The \`cstack\` MCP server gives you the tools to drive it.

1. **Ask through the town.** Ask every question with the \`ask\` tool of the \`cstack\` MCP
   server: Q0, Q1 to Q13, the plan approval, conflicts, preset codes, missing tools,
   "install X then continue", and a blocked step after 3 attempts. Never ask in the terminal and never
   use \`AskUserQuestion\`. The tool returns \`{ optionIds, text? }\`: that is the user's
   answer, and you must use it as given. The page never answers on its own. The tool
   waits until the user answers, so do not continue before it returns.

2. **Use the slot and option ids below.** Pass the \`slot\` the question fills and option
   ids from its row. Pass \`slot: null\` for a question that isn't a stack choice. Set
   \`freeText: true\` for the project name and for preset codes.

   | Slot             | Option ids                                                            |
   | ---------------- | --------------------------------------------------------------------- |
   | \`name\`           | none (free text)                                                      |
   | \`structure\`      | \`single\`, \`monorepo\`                                                  |
   | \`toolchain\`      | \`vite-plus\`, \`biome-lefthook\`                                         |
   | \`packageManager\` | \`pnpm\`, \`bun\`, \`npm\`, \`yarn\`                                          |
   | \`frontend\`       | \`nextjs\`, \`tanstack-start\`                                            |
   | \`data\`           | \`none\`, \`convex\`, \`payload\`, \`drizzle\`                                |
   | \`api\`            | \`builtin\`, \`orpc\`, \`trpc\`, \`hono\`, \`elysia\`, \`nestjs\`                 |
   | \`database\`       | \`postgres\`, \`mysql\`, \`sqlite\`, \`mongodb\`                              |
   | \`deploy\`         | \`vercel\`, \`sst\`, \`none\`                                               |
   | \`dbHost\`         | \`neon\`, \`supabase\`, \`aws\`, \`planetscale\`, \`turso\`, \`atlas\`, \`local\`   |
   | \`auth\`           | \`none\`, \`better-auth\`, \`clerk\`, \`workos\`, \`convex-auth-v2\`, \`payload\` |
   | \`authMethods\`    | \`google\`, \`github\`, \`password\`, \`magic-link\`                          |
   | \`ui\`             | \`key:value\` styling ids, through \`decide\` (see below)                 |
   | \`extras\`         | \`example\`, \`ci\`, \`env\`, \`tests\`, \`agent-docs\`                         |

   The \`ui\` slot has no fixed options. Ask the styling questions (Q12a, Q12b, a preset
   code) with \`slot: null\`. Once the styling is settled (the defaults, a decoded preset,
   or the user's answers), call \`decide\` once with \`slot: "ui"\`, one \`key:value\` option id
   per setting and one label per id, for example \`optionIds: ["style:vega",
   "baseColor:neutral", "theme:blue", "iconLibrary:lucide", "font:inter",
   "radius:0.625"]\` and \`labels: ["Vega", "Neutral", "Blue", "Lucide", "Inter",
   "0.625rem"]\`. The keys are \`style\`, \`baseColor\`, \`theme\`, \`iconLibrary\`, \`font\` and
   \`radius\`. Values are the shadcn CLI's ids, and \`radius\` is in rem without the unit.
   Leave out a key you don't know. The town repaints itself from \`baseColor\`, \`theme\`
   and \`radius\`.

3. **Keep the text short.** Option labels are at most 24 characters and descriptions fit
   on one line. You may add a \`quip\`: one short funny line, never mocking the user.

4. **Report settled answers.** Call \`decide\` for every answer you settle without asking
   (a preset, a forced choice, a skipped question), with the reason.
   This includes slots that don't apply to the chosen stack (for example \`api\`,
   \`database\` or \`dbHost\` when the config value would be null): call \`decide\` with that
   slot, \`optionIds: []\`, \`labels: ["Not needed"]\` and a reason, so every slot is settled.

5. **Plan.** In Phase 2, call \`plan\` and follow its result: \`build\`, or \`change\` with
   the slot to re-ask.

6. **Build.** In Phase 3, call \`progress\` for each numbered step, once with \`started\`
   and again with \`done\` or \`failed\`, listing the slots the step builds. Finish Phase 4
   with \`report\`, and give each manual step the slot it belongs to.

7. **Narrate.** Call \`status\` with one short line before any work that takes more than
   a few seconds.
`;
