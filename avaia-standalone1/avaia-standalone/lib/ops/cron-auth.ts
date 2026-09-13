import "server-only";

/** Shared guard for every /api/cron/* route (Agents 6, 7, 10). Vercel Cron
 *  automatically sends `Authorization: Bearer ${CRON_SECRET}` on scheduled
 *  invocations once CRON_SECRET is set as a project environment variable.
 *  Requires CRON_SECRET to be set; fails closed (denies) if it isn't. */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
