import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { resend } from "./lib/email"

// Convex Auth mounts its own routes (/auth/*, /oauth/google/*) through the
// components in convex.config.ts, so only app routes live here.
const http = httpRouter()

// Delivery status events from Resend. Point a Resend webhook at
// https://<deployment>.convex.site/resend-webhook and set RESEND_WEBHOOK_SECRET.
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction((ctx, req) => resend.handleResendEventWebhook(ctx, req)),
})

export default http
