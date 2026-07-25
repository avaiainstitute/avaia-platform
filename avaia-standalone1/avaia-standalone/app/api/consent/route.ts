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

  const { error } = await supabase
    .from("profiles")
    .update({
      consent_at: new Date().toISOString(),
      disclaimer_version: DISCLAIMER_VERSION,
      adult_confirmed: age === "adult",
      minor_with_guardian: age === "minor",
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
