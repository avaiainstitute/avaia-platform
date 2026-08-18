import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DISCLAIMER_VERSION } from "@/lib/safety";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const age = body?.age;
  if (age !== "adult" && age !== "minor") {
    return NextResponse.json({ error: "Please confirm your eligibility." }, { status: 400 });
  }
  // Fully separate from the required disclaimer above -- optional, off by
  // default, and only ever written here when explicitly opted in.
  const marketingConsent = body?.marketingConsent === true;

  // .select() so we can tell "updated" from "matched nothing" — an UPDATE
  // that matches zero rows (e.g. the profile row doesn't exist yet, a race
  // with the signup trigger) returns success with an empty array, not an
  // error. Reporting ok:true in that case would let the client redirect to
  // /journey believing consent was recorded when it silently wasn't —
  // /journey would then correctly send them back to /welcome, appearing to
  // loop even though nothing here calls redirect() in a cycle.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      consent_at: new Date().toISOString(),
      disclaimer_version: DISCLAIMER_VERSION,
      adult_confirmed: age === "adult",
      minor_with_guardian: age === "minor",
    })
    .eq("id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Could not find your profile to save this to. Please try signing in again." },
      { status: 404 }
    );
  }

  // Deliberately a separate, best-effort write -- never lets an optional
  // marketing opt-in block the required consent above, which has already
  // succeeded by this point. Also means a deployment that hasn't yet run
  // supabase/migrations/0009_marketing_consent.sql fails quietly here
  // instead of stranding a first-time Host outside the free IAP.
  if (marketingConsent) {
    const { error: marketingError } = await supabase
      .from("profiles")
      .update({
        marketing_consent: true,
        marketing_consent_at: new Date().toISOString(),
        marketing_consent_source: "welcome",
      })
      .eq("id", user.id);
    if (marketingError) {
      console.error("AVAIA marketing consent write failed:", marketingError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
