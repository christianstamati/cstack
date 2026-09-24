import { run } from "./exec"

export async function isGithubReady(cwd: string) {
  return run(["gh", "auth", "status"], { cwd }).then(
    () => true,
    () => false
  )
}

/** Creates the GitHub repo and adds it as `origin`, without pushing. */
export async function createGithubRepo(
  root: string,
  name: string,
  visibility: "private" | "public"
) {
  await run(
    [
      "gh",
      "repo",
      "create",
      name,
      `--${visibility}`,
      "--source",
      ".",
      "--remote",
      "origin",
    ],
    { cwd: root }
  )
  const { stdout } = await run(
    ["gh", "repo", "view", "--json", "nameWithOwner,url"],
    { cwd: root }
  )
  return JSON.parse(stdout) as { nameWithOwner: string; url: string }
}

export async function pushMain(root: string) {
  await run(["git", "push", "-u", "origin", "main"], { cwd: root })
}
