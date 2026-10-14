"use client"

import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { type ReactNode, useState } from "react"

/**
 * TanStack Query drives all data fetching. The Convex adapter turns every
 * `convexQuery(...)` into a live subscription that pushes updates into the
 * query cache. Convex Auth keeps the session in the browser.
 */
export function Providers({ children }: { children: ReactNode }) {
  // One set of clients per browser tab, and per server render.
  const [{ convexQueryClient, queryClient }] = useState(createClients)

  return (
    <QueryClientProvider client={queryClient}>
      <ConvexAuthProvider
        client={convexQueryClient.convexClient}
        api={api.auth}
      >
        {children}
      </ConvexAuthProvider>
    </QueryClientProvider>
  )
}

function createClients() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Run `bun dev` from the repo root so Convex can write packages/backend/.env.local."
    )
  }
  const convexQueryClient = new ConvexQueryClient(convexUrl)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)
  return { convexQueryClient, queryClient }
}
