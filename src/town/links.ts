// How the stack's pieces connect, drawn as glowing cables between buildings in the town.
// Pure data and a pure helper: the browser page bundles this file, so no Node imports.
import type { SlotId } from "./catalog.ts";
import type { Placement } from "./protocol.ts";

/** Pairs of slots that depend on each other. */
export const LINKS: ReadonlyArray<readonly [SlotId, SlotId]> = [
  ["frontend", "api"],
  ["api", "data"],
  // Only without an API layer; see `activeLinks`.
  ["frontend", "data"],
  ["data", "database"],
  ["database", "dbHost"],
  ["auth", "data"],
  ["auth", "frontend"],
  ["authMethods", "auth"],
  ["deploy", "frontend"],
  ["ui", "frontend"],
  // The foundation the app stands on.
  ["structure", "frontend"],
  ["toolchain", "frontend"],
  ["packageManager", "frontend"],
];

/** A placement that puts something on its lot: not "Not needed" (no options) and not an
 * explicit "none" (no backend, no auth, no deployment). */
function isReal(placement: Placement | undefined): boolean {
  return (
    placement !== undefined &&
    placement.optionIds.length > 0 &&
    !(placement.optionIds.length === 1 && placement.optionIds[0] === "none")
  );
}

/** The links to draw: both ends really placed. The frontend links straight to the data
 * layer only while there is no real API layer between them. */
export function activeLinks(
  placements: Partial<Record<SlotId, Placement>>,
): Array<[SlotId, SlotId]> {
  const hasApi = isReal(placements.api);
  return LINKS.filter(([a, b]) => {
    if (!isReal(placements[a]) || !isReal(placements[b])) return false;
    const direct = (a === "frontend" && b === "data") || (a === "data" && b === "frontend");
    return !(direct && hasApi);
  }).map(([a, b]) => [a, b]);
}
