import auth from "@convex-dev/auth/core/convex.config.js"
import oauth from "@convex-dev/auth/providers/oauth/convex.config.js"
import { defineApp } from "convex/server"
import { v } from "convex/values"

// Deployment env vars, validated on every push. Set them with
// `bunx convex env set` in packages/backend (see README.md).
const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    AUTH_GOOGLE_CLIENT_ID: v.string(),
    AUTH_GOOGLE_CLIENT_SECRET: v.string(),
  },
})

// Convex Auth core: sessions, JWT signing, and the JWKS served at /auth.
app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
})

// Google sign-in. Register `<CONVEX_SITE_URL>/oauth/google/callback` as a
// redirect URI in the Google Cloud console: http://127.0.0.1:<port>/... for a
// local deployment, https://<deployment>.convex.site/... for a cloud one.
app.use(oauth, {
  name: "oauthGoogle",
  httpPrefix: "/oauth/google",
  env: {
    CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
    CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
  },
})

export default app
