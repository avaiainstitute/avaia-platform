// Shared CORS allowlist for the Pink Shoelace public-facing API routes
// (/api/pink/contact, /api/pink/participation).
//
// thepinkshoelace.org and www.thepinkshoelace.org serve identical content
// with no redirect between them (confirmed by direct request), so real
// visitors can legitimately submit a form from either host. A single
// static Access-Control-Allow-Origin value can only ever match one of
// them, which silently breaks the other for anyone on that host. This
// helper reflects whichever allowed origin the incoming request actually
// used instead of hardcoding one.
//
// PINK_SITE_ORIGIN can override the default allowlist with a
// comma-separated list of origins (e.g. to also allow a preview
// deployment of the Pink Shoelace site while testing). Not set today.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://thepinkshoelace.org",
  "https://www.thepinkshoelace.org",
];

function allowedOrigins(): string[] {
  const override = process.env.PINK_SITE_ORIGIN;
  if (!override) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = override
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

export function pinkCorsHeaders(request: Request): Record<string, string> {
  const allowed = allowedOrigins();
  const requestOrigin = request.headers.get("origin") || "";
  const allowOrigin = allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
