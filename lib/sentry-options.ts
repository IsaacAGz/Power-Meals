// Shared by the server (instrumentation.ts), the browser (instrumentation-client.ts) and the timer scripts
// (scripts/run-job.ts), so no server-only import. NEXT_PUBLIC_ values are inlined at build time; set them before
// `npm run build`.

// order_ref is the bearer token for a receipt; token is an email confirmation or password reset link.
const SECRET_QUERY = /([?&](?:order_ref|token)=)[^&#\s"]*/gi;

export function scrubUrl(value: string): string {
  return value.replace(SECRET_QUERY, "$1[redacted]");
}

function scrubStrings(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) if (typeof value === "string") data[key] = scrubUrl(value);
}

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    // Off without a DSN, like SES, SQS and WhatsApp: dev, tests and Playwright send nothing.
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    // Errors only; leaving tracesSampleRate unset keeps performance tracing off.
    // The SDK collects all of these by default. Customer names, phones, addresses and session cookies must not
    // leave the server, so only the stack trace and the route are sent.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend<T extends { request?: { url?: string } }>(event: T): T {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      return event;
    },
    // Navigation and fetch breadcrumbs carry full URLs, including receipt and reset links.
    beforeBreadcrumb<T extends { message?: string; data?: Record<string, unknown> }>(crumb: T): T {
      if (crumb.message) crumb.message = scrubUrl(crumb.message);
      if (crumb.data) scrubStrings(crumb.data);
      return crumb;
    },
  };
}
