import { expect, test } from "vite-plus/test";

import { SLOTS } from "../../../src/town/catalog.ts";
import { logoFor, plateFor } from "./logos.ts";

test("every catalog option resolves to an icon or a monogram", () => {
  for (const slot of SLOTS)
    for (const option of slot.options) {
      const logo = logoFor(slot.id, option.id);
      expect(logo, `${slot.id}:${option.id}`).not.toBeNull();
      if (logo?.kind === "icon") {
        expect(logo.path.length).toBeGreaterThan(10);
        expect(logo.hex).toMatch(/^#[0-9a-f]{6}$/);
      } else {
        expect(logo?.text.length).toBeGreaterThan(0);
      }
    }
});

test("Convex carries the real Convex icon", () => {
  expect(logoFor("data", "convex")).toMatchObject({ kind: "icon", title: "Convex" });
});

test("unknown options have no logo", () => {
  expect(logoFor("frontend", "solid-start")).toBeNull();
});

test("logos get a plate that contrasts with them", () => {
  expect(plateFor("#000000")).toBe(plateFor("#4169e1"));
  expect(plateFor("#ffffff")).not.toBe(plateFor("#000000"));
  expect(plateFor("#c5f74f")).toBe(plateFor("#ffffff"));
});
