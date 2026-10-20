import { expect, test } from "vite-plus/test";

import type { SlotId } from "../src/town/catalog.ts";
import { activeLinks, LINKS } from "../src/town/links.ts";
import type { Placement } from "../src/town/protocol.ts";

type Placements = Partial<Record<SlotId, Placement>>;

function placed(entries: Record<string, string[]>): Placements {
  const placements: Placements = {};
  Object.entries(entries).forEach(([slot, optionIds]) => {
    placements[slot as SlotId] = {
      slot: slot as SlotId,
      optionIds,
      labels: optionIds.length ? optionIds : ["Not needed"],
      auto: optionIds.length === 0,
      lot: null,
    };
  });
  return placements;
}

const has = (links: Array<[SlotId, SlotId]>, a: SlotId, b: SlotId) =>
  links.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

test("links connect distinct slots, each pair once", () => {
  const keys = LINKS.map(([a, b]) => [a, b].sort().join("|"));
  expect(new Set(keys).size).toBe(keys.length);
  for (const [a, b] of LINKS) expect(a).not.toBe(b);
});

test("no links until both ends are placed", () => {
  expect(activeLinks({})).toEqual([]);
  expect(activeLinks(placed({ frontend: ["nextjs"] }))).toEqual([]);
  const links = activeLinks(placed({ frontend: ["nextjs"], deploy: ["vercel"] }));
  expect(links).toEqual([["deploy", "frontend"]]);
});

test("not-needed and 'none' ends are skipped", () => {
  const links = activeLinks(
    placed({ data: ["convex"], database: [], dbHost: [], auth: ["none"], frontend: ["nextjs"] }),
  );
  expect(has(links, "data", "database")).toBe(false);
  expect(has(links, "database", "dbHost")).toBe(false);
  expect(has(links, "auth", "frontend")).toBe(false);
  expect(has(links, "frontend", "data")).toBe(true);
});

test("the frontend talks to the data layer directly only without an API layer", () => {
  const withApi = activeLinks(placed({ frontend: ["nextjs"], api: ["hono"], data: ["drizzle"] }));
  expect(has(withApi, "frontend", "api")).toBe(true);
  expect(has(withApi, "api", "data")).toBe(true);
  expect(has(withApi, "frontend", "data")).toBe(false);

  const notNeeded = activeLinks(placed({ frontend: ["nextjs"], api: [], data: ["convex"] }));
  expect(has(notNeeded, "frontend", "data")).toBe(true);
  expect(has(notNeeded, "frontend", "api")).toBe(false);

  const unanswered = activeLinks(placed({ frontend: ["nextjs"], data: ["convex"] }));
  expect(has(unanswered, "frontend", "data")).toBe(true);
});
