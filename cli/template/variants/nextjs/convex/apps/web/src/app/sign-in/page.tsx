"use client"

import { useConvexAuth } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

import { SignInCard } from "@/components/auth/SignInCard"

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary on a prerendered page.
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  )
}

function SignIn() {
  const redirect = safeRedirect(useSearchParams().get("redirect"))
  const { isAuthenticated } = useConvexAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirect)
    }
  }, [isAuthenticated, redirect, router])

  if (isAuthenticated) {
    return null
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <SignInCard />
    </main>
  )
}

/** Only allow same-origin paths, never `//evil.com`. */
function safeRedirect(redirect: string | null) {
  return redirect?.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/dashboard"
}
