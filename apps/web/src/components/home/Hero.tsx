import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useConvexAuth } from "convex/react"
import { site } from "@/lib/site"

/** The landing page intro, with a link to the dashboard or to sign in. */
export function Hero() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading font-semibold text-3xl tracking-tight">
          {site.name}
        </h1>
        <p className="text-muted-foreground">{site.description}</p>
      </div>
      <div className="flex gap-2">
        {isAuthenticated ? (
          <Button render={<Link to="/dashboard" />} nativeButton={false}>
            Open dashboard
          </Button>
        ) : (
          <Button
            render={<Link to="/sign-in" />}
            nativeButton={false}
            disabled={isLoading}
          >
            Sign in
          </Button>
        )}
      </div>
    </div>
  )
}
