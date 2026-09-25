import { useAuthActions } from "@convex-dev/auth/react"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"

/** The signed-in user's name and a sign-out button. */
export function UserMenu() {
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
