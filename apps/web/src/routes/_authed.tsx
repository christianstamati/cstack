import { useAuthActions } from "@convex-dev/auth/react"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { useConvexAuth } from "convex/react"
import { useEffect } from "react"
import { site } from "@/lib/site"

// Everything under this layout requires a signed-in user. Convex Auth keeps
// the session in the browser, so these routes render on the client only.
export const Route = createFileRoute("/_authed")({
  ssr: false,
  component: AuthedLayout,
})

function AuthedLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const navigate = useNavigate()
  const signedOut = !isLoading && !isAuthenticated

  useEffect(() => {
    if (signedOut) {
      // Read the URL once here. Subscribing to the location would re-run the
      // redirect on every navigation it causes.
      const { pathname, search } = window.location
      void navigate({
        to: "/sign-in",
        search: { redirect: pathname + search },
        replace: true,
      })
    }
  }, [signedOut, navigate])

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
          <Link to="/" className="font-heading font-semibold">
            {site.name}
          </Link>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}

function UserMenu() {
  const { signOut } = useAuthActions()
  const { data: viewer } = useQuery(convexQuery(api.users.viewer, {}))

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="truncate text-muted-foreground">
        {viewer?.name ?? viewer?.email}
      </span>
      <Button variant="outline" size="sm" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
