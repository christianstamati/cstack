import { expect, test } from "vite-plus/test";

import { clockAt, parseTimeOverride, skyAt, sunTimes, type Sky } from "./sky.ts";

/** A local time on 21 June 2026 (or another day of the year). */
const at = (hours: number, minutes = 0, month = 5, day = 21) =>
  new Date(2026, month, day, hours, minutes);

test("sunrise and sunset follow the season", () => {
  const june = sunTimes(at(12));
  expect(june.sunrise).toBeCloseTo(6.5, 1);
  expect(june.sunset).toBeCloseTo(19.5, 1);
  const december = sunTimes(at(12, 0, 11, 21));
  expect(december.sunrise).toBeCloseTo(7.5, 1);
  expect(december.sunset).toBeCloseTo(17, 1);
  // In between, in between.
  const march = sunTimes(at(12, 0, 2, 20));
  expect(march.sunrise).toBeGreaterThan(6.5);
  expect(march.sunrise).toBeLessThan(7.5);
});

test("midday is day, with the sun high in the south", () => {
  const sky = skyAt(at(12));
  expect(sky.daylight).toBeGreaterThan(0.95);
  expect(sky.dusk).toBe(0);
  expect(sky.sunElevation).toBeGreaterThan(0.6);
  expect(sky.sun[2]).toBeGreaterThan(0);
  expect(sky.lampsOn).toBe(false);
  expect(sky.windowsLit).toBe(false);
  expect(sky.starsVisible).toBe(false);
  // The sun is the light, and it is the highest around midday.
  expect(sky.light.direction).toEqual(sky.sun);
  for (const hour of [8, 10, 15, 18])
    expect(skyAt(at(hour)).sunElevation).toBeLessThan(sky.sunElevation);
});

test("late at night: stars, lamps and lit windows under the moon", () => {
  const sky = skyAt(at(23));
  expect(sky.daylight).toBeLessThan(0.05);
  expect(sky.sunElevation).toBeLessThan(0);
  expect(sky.lampsOn).toBe(true);
  expect(sky.windowsLit).toBe(true);
  expect(sky.starsVisible).toBe(true);
  // The moon lights the town from above the horizon.
  expect(sky.light.direction[1]).toBeGreaterThan(0);
  expect(skyAt(at(3)).starsVisible).toBe(true);
});

test("the sun rises in the east and sets in the west", () => {
  const { sunrise, sunset } = sunTimes(at(12));
  const morning = skyAt(at(Math.floor(sunrise + 1), Math.round(((sunrise + 1) % 1) * 60)));
  expect(morning.sun[0]).toBeGreaterThan(0.5);
  expect(morning.sunElevation).toBeGreaterThan(0);
  const evening = skyAt(at(Math.floor(sunset - 1), Math.round(((sunset - 1) % 1) * 60)));
  expect(evening.sun[0]).toBeLessThan(-0.5);
  expect(evening.sunElevation).toBeGreaterThan(0);
});

test("dawn and dusk blend warm light around sunrise and sunset", () => {
  const { sunrise, sunset } = sunTimes(at(12));
  for (const event of [sunrise, sunset]) {
    for (const offset of [-5, 0, 5]) {
      const minutes = Math.round(event * 60) + offset;
      const sky = skyAt(at(Math.floor(minutes / 60), minutes % 60));
      expect(sky.dusk).toBeGreaterThan(0.6);
      expect(sky.daylight).toBeGreaterThan(0.2);
      expect(sky.daylight).toBeLessThan(0.8);
      // Warm: more red than blue in the light.
      expect(sky.light.color[0]).toBeGreaterThan(sky.light.color[2]);
    }
    // About 45 minutes either side, it's over.
    const after = Math.round(event * 60) + 60;
    expect(skyAt(at(Math.floor(after / 60), after % 60)).dusk).toBe(0);
  }
});

/** Every number in the sky, flattened, to compare two moments. */
function numbers(sky: Sky): number[] {
  return [
    ...sky.sun,
    ...sky.light.color,
    sky.light.intensity,
    ...sky.light.direction.map((d) => d * sky.light.intensity),
    ...sky.ambient.color,
    sky.ambient.intensity,
    ...sky.hemisphere.sky,
    ...sky.hemisphere.ground,
    sky.hemisphere.intensity,
    ...sky.top,
    ...sky.bottom,
    sky.daylight,
    sky.dusk,
  ];
}

test("the look changes smoothly: a minute later is never far off", () => {
  for (const [month, day] of [
    [5, 21],
    [11, 21],
    [2, 20],
  ] as const) {
    let before = numbers(skyAt(new Date(2026, month, day, 0, 0)));
    for (let minute = 1; minute <= 24 * 60 + 5; minute++) {
      const now = numbers(skyAt(new Date(2026, month, day, 0, minute)));
      now.forEach((value, i) => {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value - before[i]!), `minute ${minute}, value ${i}`).toBeLessThan(0.06);
      });
      before = now;
    }
  }
});

test("?time=HH:MM overrides the clock", () => {
  expect(parseTimeOverride("?time=21:30")).toEqual({ hours: 21, minutes: 30 });
  expect(parseTimeOverride("?token=abc&time=06:05")).toEqual({ hours: 6, minutes: 5 });
  expect(parseTimeOverride("?time=7:15")).toEqual({ hours: 7, minutes: 15 });
  expect(parseTimeOverride("?time=00:00")).toEqual({ hours: 0, minutes: 0 });
  for (const bad of [
    "",
    "?token=abc",
    "?time=24:00",
    "?time=12:60",
    "?time=noon",
    "?time=12",
    "?time=-1:30",
    "?time=1:2:3",
  ])
    expect(parseTimeOverride(bad), bad).toBeNull();
  const now = new Date(2026, 9, 20, 14, 7, 33);
  const fixed = clockAt(now, { hours: 21, minutes: 30 });
  expect([fixed.getFullYear(), fixed.getMonth(), fixed.getDate()]).toEqual([2026, 9, 20]);
  expect([fixed.getHours(), fixed.getMinutes(), fixed.getSeconds()]).toEqual([21, 30, 0]);
  expect(clockAt(now, null)).toBe(now);
});
