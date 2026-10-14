import "@workspace/ui/globals.css"
import { Toaster } from "@workspace/ui/components/sonner"
import type { Metadata } from "next"
import type { ReactNode } from "react"

import { Providers } from "@/components/layout/Providers"
import { site } from "@/lib/site"

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  manifest: "/manifest.json",
}

// Follow the OS color scheme. Runs before paint to avoid a flash.
const themeScript = `(() => {
  const media = matchMedia("(prefers-color-scheme: dark)")
  const apply = () => document.documentElement.classList.toggle("dark", media.matches)
  apply()
  media.addEventListener("change", apply)
})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-svh antialiased">
        <Providers>{children}</Providers>
        <Toaster richColors />
      </body>
    </html>
  )
}
