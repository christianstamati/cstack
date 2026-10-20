import { expect, test } from "vite-plus/test";

import { SLOTS } from "../../src/town/catalog.ts";
import {
  answerOutcome,
  decorSpots,
  LOT_SIZE,
  ISLAND_RADIUS,
  lotPosition,
  readMuted,
  reconnectDelay,
  tokenFrom,
  writeMuted,
} from "./logic.ts";

test("every slot has a lot on the island", () => {
  for (const slot of SLOTS) expect(lotPosition(slot.id)).toHaveLength(3);
});

test("lots sit on the island top, inside its edge", () => {
  for (const slot of SLOTS) {
    const [x, y, z] = lotPosition(slot.id);
    expect([x, z]).toEqual([...slot.lot]);
    expect(y).toBe(0);
    expect(Math.hypot(x, z)).toBeLessThan(ISLAND_RADIUS - 1);
  }
});

test("the token comes from the query string", () => {
  expect(tokenFrom("?token=abc")).toBe("abc");
  expect(tokenFrom("?x=1&token=abc")).toBe("abc");
  expect(tokenFrom("")).toBeNull();
});

test("reconnect delay backs off and is capped", () => {
  expect(reconnectDelay(0)).toBe(500);
  expect(reconnectDelay(1)).toBe(1000);
  expect(reconnectDelay(2)).toBe(2000);
  expect(reconnectDelay(10)).toBe(5000);
});

test("answer responses map to outcomes", () => {
  expect(answerOutcome(204)).toBe("ok");
  expect(answerOutcome(409)).toBe("stale");
  expect(answerOutcome(400)).toBe("invalid");
  expect(answerOutcome(401)).toBe("invalid");
});

test("mute state round-trips through storage and survives a broken one", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  expect(readMuted(storage)).toBe(false);
  writeMuted(storage, true);
  expect(readMuted(storage)).toBe(true);
  writeMuted(storage, false);
  expect(readMuted(storage)).toBe(false);

  const broken = {
    getItem: (): string | null => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  expect(readMuted(broken)).toBe(false);
  expect(() => writeMuted(broken, true)).not.toThrow();
  expect(readMuted(undefined)).toBe(false);
});

test("trees and rocks keep clear of every lot and stay on the island", () => {
  const spots = decorSpots();
  expect(spots.length).toBeGreaterThan(5);
  for (const spot of spots) {
    expect(Math.hypot(spot.x, spot.z)).toBeLessThan(ISLAND_RADIUS - 2);
    for (const slot of SLOTS) {
      const [x, , z] = lotPosition(slot.id);
      expect(Math.hypot(spot.x - x, spot.z - z)).toBeGreaterThan(LOT_SIZE);
    }
  }
  expect(decorSpots()).toEqual(spots);
});
