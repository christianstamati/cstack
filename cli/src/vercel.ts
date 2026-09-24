import { run } from "./exec"

const vercelApi = ["vercel", "api", "--raw", "--non-interactive"]

export async function isVercelReady(cwd: string) {
  return run(["vercel", "whoami"], { cwd }).then(
    () => true,
    () => false
  )
}

/**
 * Creates a Vercel project for apps/web, connected to the GitHub repo so
 * every push deploys. The Convex deploy key is stored as a sensitive env var;
 * apps/web/vercel.json uses it to deploy the backend before each build.
 */
export async function createVercelProject(options: {
  root: string
  name: string
  repo: string
  convexDeployKey: string
}) {
  const body = {
    name: options.name,
    framework: "tanstack-start",
    rootDirectory: "apps/web",
    gitRepository: { type: "github", repo: options.repo },
    // Only production has a Convex deploy key, so preview builds (including
    // Renovate PRs) would fail. GitHub CI checks PRs instead.
    previewDeploymentsDisabled: true,
    environmentVariables: [
      {
        key: "CONVEX_DEPLOY_KEY",
        value: options.convexDeployKey,
        type: "sensitive",
        target: ["production"],
      },
    ],
  }
  // The body carries a secret, so it goes over stdin.
  const created = await run(
    [...vercelApi, "/v11/projects", "-X", "POST", "--input", "-"],
    { cwd: options.root, input: JSON.stringify(body) }
  )
  const project = JSON.parse(created.stdout) as { id: string; name: string }

  const domains = await run(
    [...vercelApi, `/v9/projects/${project.id}/domains`],
    { cwd: options.root }
  )
  const { domains: list } = JSON.parse(domains.stdout) as {
    domains: { name: string }[]
  }
  const domain =
    list.find((d) => d.name.endsWith(".vercel.app"))?.name ??
    `${project.name}.vercel.app`

  return {
    id: project.id,
    url: `https://${domain}`,
    dashboardUrl: `https://vercel.com/${await vercelScope(options.root)}/${project.name}`,
  }
}

async function vercelScope(cwd: string) {
  const { stdout } = await run([...vercelApi, "/v2/user"], { cwd })
  const { user } = JSON.parse(stdout) as {
    user: { username: string; defaultTeamId: string | null }
  }
  if (!user.defaultTeamId) return user.username
  const team = await run([...vercelApi, `/v2/teams/${user.defaultTeamId}`], {
    cwd,
  })
  return (JSON.parse(team.stdout) as { slug: string }).slug
}
