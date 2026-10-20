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

// Some xdg-open setups don't exit until the browser closes, so a launch that is
// still running after this long counts as opened.
const QUICK_FAILURE_MS = 2000;

/** Opens `url` in the default browser. Resolves false on any failure; never throws. */
export function openBrowser(
  url: string,
  opener: readonly [command: string, ...args: string[]] = defaultOpener(),
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const [command, ...args] = opener;
      const child = spawn(command, [...args, url], { stdio: "ignore" });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = (opened: boolean) => {
        clearTimeout(timer);
        resolve(opened);
      };
      child.once("error", () => done(false));
      child.once("exit", (code) => done(code === 0));
      child.once("spawn", () => {
        child.unref();
        timer = setTimeout(() => done(true), QUICK_FAILURE_MS);
      });
    } catch {
      resolve(false);
    }
  });
}
