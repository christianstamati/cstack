import type { AuthConfig } from "convex/server"

// Convex Auth signs its own JWTs. CONVEX_SITE_URL is set automatically on
// every deployment.
const siteUrl = process.env.CONVEX_SITE_URL as string

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: siteUrl,
      jwks: `${siteUrl}/auth/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig
