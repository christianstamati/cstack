import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { useEffect } from "react"
import { SignInCard } from "@/components/auth/sign-in-card"

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search): { redirect?: string } => {
    const redirect = search.redirect
    // Only allow same-origin paths, never `//evil.com`.
    return typeof redirect === "string" &&
      redirect.startsWith("/") &&
      !redirect.startsWith("//")
      ? { redirect }
      : {}
  },
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: SignIn,
})

function SignIn() {
  const { redirect = "/dashboard" } = Route.useSearch()
  const { isAuthenticated } = useConvexAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ href: redirect, replace: true })
    }
  }, [isAuthenticated, redirect, navigate])

  if (isAuthenticated) {
    return null
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <SignInCard />
    </main>
  )
}
