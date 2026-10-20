// Day and night from the browser's local clock: where the sun is, the light it gives, the
// sky's colours and whether the lamps are on. Pure, so it can be tested; the scene reads it
// once a minute and eases towards it.
//
// Sunrise and sunset come from the date alone (no location): about 06:30 to 19:30 at the
// June solstice and 07:30 to 17:00 at the December one, northern-hemisphere style. The sun
// rises in the east (+x), stands in the south (+z, behind the default camera) at midday and
// sets in the west; the moon is where the sun isn't.

export type RGB = [r: number, g: number, b: number];
export type Vec3 = [x: number, y: number, z: number];

export interface Sky {
  /** Unit vector towards the sun (x east, y up, z south). */
  sun: Vec3;
  /** The sun's height above the horizon, in radians (negative at night). */
  sunElevation: number;
  /** The key light: the sun by day, the moon by night (never both). */
  light: { color: RGB; intensity: number; direction: Vec3 };
  ambient: { color: RGB; intensity: number };
  hemisphere: { sky: RGB; ground: RGB; intensity: number };
  /** The background gradient, top of the page to the bottom. */
  top: RGB;
  bottom: RGB;
  /** 1 in full day, 0 at night; in between at dawn and dusk. */
  daylight: number;
  /** How much of the warm sunrise / sunset glow there is, 0 to 1. */
  dusk: number;
  lampsOn: boolean;
  windowsLit: boolean;
  starsVisible: boolean;
}

function hex(value: string): RGB {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
}

/** A night colour, a day colour and the warm one that takes over at dawn and dusk. */
function tint(night: string, day: string, warm: string, daylight: number, dusk: number): RGB {
  return mixRGB(mixRGB(hex(night), hex(day), daylight), hex(warm), dusk);
}

const DAY_MS = 86_400_000;
/** Day of the year of the June solstice (21 June), counting 1 January as 0. */
const JUNE_SOLSTICE = 171;

/** 1 at the June solstice, -1 at the December one. */
function season(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) /
      DAY_MS,
  );
  return Math.cos((2 * Math.PI * (day - JUNE_SOLSTICE)) / 365.25);
}

/** Approximate local sunrise and sunset, in hours after midnight. */
export function sunTimes(date: Date): { sunrise: number; sunset: number } {
  const s = season(date);
  return { sunrise: 7 - 0.5 * s, sunset: 18.25 + 1.25 * s };
}

/** How long the warm light lasts either side of sunrise and sunset, in hours. */
const GLOW_HOURS = 0.75;
/** How long the light takes to come up (or go down) either side of sunrise (sunset). */
const TWILIGHT_HOURS = 0.5;
/** How far below the horizon the sun sinks at midnight (so the moon climbs as high). */
const NIGHT_DEPTH = 0.9;
const SUN_INTENSITY = 2.4;
const MOON_INTENSITY = 0.9;

export function skyAt(date: Date): Sky {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const { sunrise, sunset } = sunTimes(date);
  // The sun's arc: from the east at sunrise, through the south, to the west at sunset;
  // then on round under the horizon through the north back to the east.
  let turn: number;
  let elevation: number;
  if (hours >= sunrise && hours <= sunset) {
    const p = (hours - sunrise) / (sunset - sunrise);
    turn = Math.PI * p;
    elevation = (0.75 + 0.35 * season(date)) * Math.sin(Math.PI * p);
  } else {
    const night = 24 - (sunset - sunrise);
    const q = ((hours - sunset + 24) % 24) / night;
    turn = Math.PI * (1 + q);
    elevation = -NIGHT_DEPTH * Math.sin(Math.PI * q);
  }
  const sun: Vec3 = [
    Math.cos(elevation) * Math.cos(turn),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(turn),
  ];

  const daylight =
    smoothstep(-TWILIGHT_HOURS, TWILIGHT_HOURS, hours - sunrise) *
    (1 - smoothstep(-TWILIGHT_HOURS, TWILIGHT_HOURS, hours - sunset));
  const glow = (event: number) => 1 - smoothstep(0, GLOW_HOURS, Math.abs(hours - event));
  const dusk = Math.max(glow(sunrise), glow(sunset));

  const byDay = elevation >= 0;
  const intensity = byDay
    ? SUN_INTENSITY * smoothstep(0, 0.5, elevation)
    : MOON_INTENSITY * smoothstep(0, 0.5, -elevation);
  const direction: Vec3 = byDay ? sun : [-sun[0], -sun[1], -sun[2]];

  return {
    sun,
    sunElevation: elevation,
    light: {
      color: tint("#9fb2ff", "#fff3e0", "#ff9a52", daylight, dusk * 0.9),
      intensity,
      direction,
    },
    ambient: {
      color: tint("#4656a0", "#fff8f0", "#ffb59e", daylight, dusk * 0.6),
      // A little more in the warm glow, while the sun is too low to light much.
      intensity: mix(0.7, 0.85, daylight) + 0.3 * dusk,
    },
    hemisphere: {
      sky: tint("#5262b4", "#e4edff", "#ffc3a3", daylight, dusk * 0.6),
      ground: tint("#22263f", "#cfdcb6", "#b88d7e", daylight, dusk * 0.5),
      intensity: mix(0.9, 1.1, daylight) + 0.2 * dusk,
    },
    top: tint("#0c1433", "#9cc6ef", "#8d8ad8", daylight, dusk * 0.85),
    bottom: tint("#2b2f66", "#ece0f8", "#ffc39a", daylight, dusk * 0.85),
    daylight,
    dusk,
    lampsOn: daylight < 0.55,
    windowsLit: daylight < 0.6,
    starsVisible: daylight < 0.25,
  };
}

export interface TimeOverride {
  hours: number;
  minutes: number;
}

/** `?time=HH:MM` in the page's query string, to look at the town at any hour. */
export function parseTimeOverride(search: string): TimeOverride | null {
  const value = new URLSearchParams(search).get("time");
  const match = value === null ? null : /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** The time the town shows: now, or today at the overridden time. */
export function clockAt(now: Date, override: TimeOverride | null): Date {
  if (!override) return now;
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    override.hours,
    override.minutes,
  );
}
