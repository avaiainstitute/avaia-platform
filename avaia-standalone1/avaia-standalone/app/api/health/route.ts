import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Automation audit finding #1.4. A small, safe, read-only check -- no
// side effects, exposes only presence/absence of required configuration
// (never any actual secret value) and whether the database is reachable.
// Reduces "click through the site by hand after every deploy" to one GET.
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  // The conversation engine and the membership checkout cannot work without these.
  "ANTHROPIC_API_KEY",
  "STRIPE_MEMBERSHIP_PRICE_ID_MONTHLY",
  "STRIPE_MEMBERSHIP_PRICE_ID_ANNUAL",
];

export async function GET() {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  let databaseOk = false;
  let databaseError: string | null = null;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    databaseOk = !error;
    databaseError = error?.message ?? null;
  } catch (e) {
    databaseError = e instanceof Error ? e.message : String(e);
  }

  const ok = databaseOk && missingEnvVars.length === 0;

  return NextResponse.json(
    {
      ok,
      database: databaseOk ? "reachable" : "unreachable",
      databaseError,
      missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
      // Which build is actually serving this request (set by Vercel; a commit id
      // and branch name are not secrets). Lets anyone confirm what is deployed.
      deployment: {
        environment: process.env.VERCEL_ENV ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
