import { createFileRoute, Outlet } from "@tanstack/react-router"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"

// Everything under this layout requires a signed-in user. Convex Auth keeps
// the session in the browser, so these routes render on the client only.
export const Route = createFileRoute("/_authed")({
  ssr: false,
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <AuthGuard>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGuard>
  )
}
