import { useConvexAuth } from "convex/react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect } from "react"

import { LoadingScreen } from "@/components/layout/LoadingScreen"

/**
 * Renders its children only for a signed-in user. Anyone else is sent to
 * /sign-in, which brings them back here afterwards.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const router = useRouter()
  const signedOut = !isLoading && !isAuthenticated

  useEffect(() => {
    if (signedOut) {
      // Read the URL once here. Subscribing to it would re-run the redirect
      // on every navigation it causes.
      const { pathname, search } = window.location
      router.replace(
        `/sign-in?redirect=${encodeURIComponent(pathname + search)}`
      )
    }
  }, [signedOut, router])

  if (!isAuthenticated) {
    return <LoadingScreen />
  }

  return children
}
