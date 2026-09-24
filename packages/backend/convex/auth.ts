import { setupCore } from "@convex-dev/auth/core/setup"
import { setupGoogle } from "@convex-dev/auth/providers/oauth/google"
import { components, internal } from "./_generated/api"

const core = setupCore({ component: components.auth })
export const { signOut, refreshSession, isAuthenticated } = core

export const { startSignInGoogle, completeSignInGoogle } = setupGoogle(core, {
  component: components.oauthGoogle,
  // Where Google sign-in may send users back to. SITE_URL is the web app's
  // origin: http://localhost:3000 in dev, the Vercel URL in production.
  allowedRedirectOrigins: [process.env.SITE_URL ?? "http://localhost:3000"],
}).attachUserCallbacks({
  createUser: internal.users.createGoogleUser,
  onSignIn: internal.users.syncGoogleProfile,
})
