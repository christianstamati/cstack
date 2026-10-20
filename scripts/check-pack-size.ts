// Fails the publish when the npm tarball goes over the size budget.
// Run after `vp run build`: `bun scripts/check-pack-size.ts`.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

export const PACK_SIZE_LIMIT = 3 * 1024 * 1024;

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** An error message when `bytes` is over `limit`, otherwise null. */
export function checkPackSize(bytes: number, limit = PACK_SIZE_LIMIT): string | null {
  if (bytes <= limit) return null;
  return `The package tarball is ${mb(bytes)} (${bytes} bytes), over the ${mb(limit).replace(".00", "")} limit.`;
}

if (import.meta.main) {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const [info] = JSON.parse(output) as { size: number; unpackedSize: number }[];
  if (!info) throw new Error("npm pack --dry-run printed no package.");
  console.log(`Tarball: ${mb(info.size)} (${info.size} bytes), unpacked ${mb(info.unpackedSize)}.`);
  const error = checkPackSize(info.size);
  if (error) {
    console.error(error);
    process.exit(1);
  }
}
