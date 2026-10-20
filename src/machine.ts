import { spawnSync } from "node:child_process";
import { arch, platform, release } from "node:os";

// Tools the bootstrap prompt cares about: package managers, Docker for local
// databases, git and gh, and the two agent CLIs.
export const TOOL_NAMES = [
  "git",
  "gh",
  "node",
  "bun",
  "pnpm",
  "npm",
  "yarn",
  "docker",
  "claude",
  "codex",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolVersions = Record<ToolName, string | null>;

const isWindows = platform() === "win32";

export function toolVersion(command: string): string | null {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: 10_000,
    // npm, pnpm and yarn are `.cmd` shims on Windows, which only run through a shell.
    shell: isWindows,
  });
  if (result.error !== undefined || result.status !== 0) {
    return null;
  }
  const firstLine = `${result.stdout}${result.stderr}`.trim().split("\n")[0] ?? "";
  return firstLine.trim() || "installed";
}

export function detectTools(): ToolVersions {
  const versions = {} as ToolVersions;
  for (const name of TOOL_NAMES) {
    versions[name] = toolVersion(name);
  }
  return versions;
}

export function formatTools(versions: ToolVersions): string {
  return TOOL_NAMES.map((name) => `- ${name}: ${versions[name] ?? "not installed"}`).join("\n");
}

export function describeOs(): string {
  return `${platform()} ${arch()} (${release()})`;
}
