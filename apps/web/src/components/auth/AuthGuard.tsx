import { useNavigate } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { type ReactNode, useEffect } from "react"
import { LoadingScreen } from "@/components/layout/LoadingScreen"

/**
 * Renders its children only for a signed-in user. Anyone else is sent to
 * /sign-in, which brings them back here afterwards.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
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
    return <LoadingScreen />
  }

  return children
}
