import { Link } from "@tanstack/react-router"
import { UserMenu } from "@/components/auth/UserMenu"
import { site } from "@/lib/site"

/** The top bar of signed-in pages. */
export function AppHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-6">
        <Link to="/" className="font-heading font-semibold">
          {site.name}
        </Link>
        <UserMenu />
      </div>
    </header>
  )
}
