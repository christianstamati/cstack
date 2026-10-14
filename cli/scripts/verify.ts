// Generates a project for each stack and checks it the way CI would: install,
// format/lint/type checks, tests and a production build. Stacks other than
// TanStack Start + Convex only exist as generated output, so this is what
// keeps them working.
//
//   bun run --cwd cli verify                              every stack
//   bun run --cwd cli verify --frontend nextjs --backend convex
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"

import {
  BACKENDS,
  type Backend,
  FRONTENDS,
  type Frontend,
  isBackend,
  isFrontend,
  type Stack,
} from "../src/stack"
import { copyTemplate } from "../src/template"

// Builds need a deployment URL; nothing connects to it.
const BUILD_ENV = {
  VITE_CONVEX_URL: "https://verify.convex.cloud",
  NEXT_PUBLIC_CONVEX_URL: "https://verify.convex.cloud",
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { frontend: { type: "string" }, backend: { type: "string" } },
})
if (values.frontend && !isFrontend(values.frontend)) {
  throw new Error(`Unknown frontend: ${values.frontend}`)
}
if (values.backend && !isBackend(values.backend)) {
  throw new Error(`Unknown backend: ${values.backend}`)
}

const frontends = values.frontend
  ? [values.frontend as Frontend]
  : (Object.keys(FRONTENDS) as Frontend[])
const backends = values.backend
  ? [values.backend as Backend]
  : (Object.keys(BACKENDS) as Backend[])

for (const frontend of frontends) {
  for (const backend of backends) {
    await verify({ frontend, backend })
  }
}

async function verify(stack: Stack) {
  const label = `${stack.frontend} + ${stack.backend}`
  const dir = join(tmpdir(), `cstack-verify-${stack.frontend}-${stack.backend}`)
  console.log(`\n=== ${label} in ${dir}`)

  await rm(dir, { recursive: true, force: true })
  await copyTemplate(dir, "verify-app", stack)
  await step(dir, ["git", "init", "--quiet"])
  await step(dir, ["bun", "install"])
  await step(dir, ["bun", "run", "check"])
  if (stack.backend !== "none") await step(dir, ["bun", "run", "test"])
  await step(dir, ["bun", "run", "build"], BUILD_ENV)
  console.log(`=== ${label}: ok`)
}

async function step(cwd: string, cmd: string[], env?: Record<string, string>) {
  console.log(`$ ${cmd.join(" ")}`)
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`\`${cmd.join(" ")}\` exited with code ${code} in ${cwd}`)
  }
}
