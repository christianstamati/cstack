import { site } from "@/lib/site"

/** The landing page intro. */
export function Hero() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        {site.name}
      </h1>
      <p className="text-muted-foreground">{site.description}</p>
    </div>
  )
}
