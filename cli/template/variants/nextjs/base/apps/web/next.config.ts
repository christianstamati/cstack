import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The shared UI package ships TypeScript source.
  transpilePackages: ["@workspace/ui"],
  // `vp check` type-checks the app with TypeScript 7. Next's own check needs
  // the TypeScript JS API, which TypeScript 7 doesn't have.
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
