import { spawn } from "node:child_process";
import { platform } from "node:os";

function defaultOpener(): readonly [string, ...string[]] {
  switch (platform()) {
    case "darwin":
      return ["open"];
    case "win32":
      return ["cmd", "/c", "start", '""'];
    default:
      return ["xdg-open"];
  }
}

/** Opens `url` in the default browser. Resolves false on any failure; never throws. */
export function openBrowser(
  url: string,
  opener: readonly [command: string, ...args: string[]] = defaultOpener(),
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const [command, ...args] = opener;
      const child = spawn(command, [...args, url], { stdio: "ignore" });
      child.once("error", () => resolve(false));
      child.once("exit", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}
