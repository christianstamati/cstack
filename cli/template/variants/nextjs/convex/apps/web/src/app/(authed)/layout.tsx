"use client"

import type { ReactNode } from "react"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"

// Everything in this group requires a signed-in user. Convex Auth keeps the
// session in the browser, so AuthGuard renders these pages on the client only.
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
