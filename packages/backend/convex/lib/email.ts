import { Resend } from "@convex-dev/resend"
import { components } from "../_generated/api"
import type { ActionCtx, MutationCtx } from "../_generated/server"

/**
 * Queued, retried, idempotent email delivery through Resend.
 * Reads RESEND_API_KEY (and RESEND_WEBHOOK_SECRET for status webhooks)
 * from the deployment environment.
 */
export const resend = new Resend(components.resend, { testMode: false })

export type Email = {
  to: string
  subject: string
  text: string
  html: string
}

const DEFAULT_FROM = "cstack <onboarding@resend.dev>"

/**
 * Enqueue an email. Without RESEND_API_KEY (e.g. a fresh dev deployment) the
 * email is logged instead of sent, so nothing that sends mail breaks.
 */
export async function sendEmail(ctx: ActionCtx | MutationCtx, email: Email) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      `RESEND_API_KEY is not set, skipping email.\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`
    )
    return
  }

  await resend.sendEmail(ctx, {
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    ...email,
  })
}
