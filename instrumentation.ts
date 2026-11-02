import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

export function register() {
  // The app has no proxy or edge routes, so only the Node.js server needs the SDK.
  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(sentryOptions());
}

// Uncaught errors from Server Components, Route Handlers and Server Actions.
export const onRequestError = Sentry.captureRequestError;
