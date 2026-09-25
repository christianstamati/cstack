export class CommandError extends Error {
  constructor(
    readonly command: string[],
    readonly exitCode: number,
    readonly output: string
  ) {
    super(
      `\`${command.join(" ")}\` exited with code ${exitCode}${output ? `:\n${output.trim()}` : ""}`
    )
  }
}

type RunOptions = {
  cwd: string
  /** Written to the command's stdin. Use this for secrets, never argv. */
  input?: string
  env?: Record<string, string | undefined>
}

/** Runs a command and returns its stdout. Throws on a non-zero exit. */
export async function run(cmd: string[], options: RunOptions) {
  const { stdout, stderr } = await exec(cmd, options)
  return { stdout: stdout.trim(), stderr: stripAnsi(stderr) }
}

async function exec(cmd: string[], options: RunOptions) {
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: options.input === undefined ? "ignore" : new Blob([options.input]),
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new CommandError(cmd, exitCode, stripAnsi(stderr || stdout))
  }
  return { stdout, stderr }
}

export function stripAnsi(text: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes
  return text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
}
