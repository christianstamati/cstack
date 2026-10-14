// Runs `convex dev` with no interactive stdin. In a terminal, convex dev asks
// on every start whether to link an account-free local deployment to your
// Convex account; without a TTY it skips that question (and auto-accepts
// local backend upgrades). This replaces `convex dev < /dev/null`, which only
// POSIX shells understand, so `bun dev` also works on Windows.
import { spawn } from "node:child_process"

// process.execPath is Bun, and `bun x` runs the convex in node_modules.
const child = spawn(process.execPath, ["x", "convex", "dev"], {
  stdio: ["ignore", "inherit", "inherit"],
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal))
}
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0))
})
