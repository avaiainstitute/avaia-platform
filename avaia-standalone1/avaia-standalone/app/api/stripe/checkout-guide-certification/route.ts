import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RETIRED. This was the pay-in-full checkout for the original $4,500
 *  Certified AVAIA Guide Program, whose payment opened candidacy
 *  automatically. That path is closed by owner decision: nobody may begin
 *  candidacy by paying here. The route is kept only so a stale client or
 *  bookmarked request gets a clear answer; it never calls Stripe and never
 *  creates a checkout session, a payment record, or a candidacy. */
export async function POST() {
  return NextResponse.json(
    { error: "This enrollment path is closed. Please contact AVAIA about the Guide pathway." },
    { status: 410 }
  );
}
