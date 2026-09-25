import {
  type OauthFlowErrorCode,
  useOauth,
  useSignInWithGoogle,
} from "@convex-dev/auth/providers/oauth/react"
import { IconBrandGoogleFilled } from "@tabler/icons-react"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useState } from "react"
import { site } from "@/lib/site"

const FLOW_ERRORS: Record<OauthFlowErrorCode, string> = {
  access_denied: "Sign-in was cancelled.",
  expired: "That sign-in took too long. Please try again.",
  rejected: "Sign-in was declined.",
  oauth_error: "Something went wrong during sign-in. Please try again.",
  invalid_flow: "This sign-in can't be completed here. Please try again.",
}

/**
 * Google is the only sign-in method. The flow redirects to Google and back to
 * the current URL, where Convex Auth finishes it and the page reacts to the
 * new session.
 */
export function SignInCard() {
  const { signInGoogle } = useSignInWithGoogle(api.auth)
  // Every failure, before or after the redirect, is reported here.
  const { flowError } = useOauth()
  const [redirecting, setRedirecting] = useState(false)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to {site.name}</CardTitle>
        <CardDescription>Continue with your Google account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          size="lg"
          disabled={redirecting}
          onClick={() => {
            setRedirecting(true)
            signInGoogle().catch(() => setRedirecting(false))
          }}
        >
          <IconBrandGoogleFilled />
          Continue with Google
        </Button>
        {flowError !== null && (
          <p role="alert" className="text-destructive text-sm">
            {flowError.message ?? FLOW_ERRORS[flowError.code]}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
