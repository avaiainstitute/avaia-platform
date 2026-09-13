import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { buildFounderDigestEmail } from "@/lib/ops/founder-digest";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = process.env.FOUNDER_DIGEST_EMAIL;
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "FOUNDER_DIGEST_EMAIL is not set -- nothing sent." },
      { status: 200 }
    );
  }

  const { subject, html } = await buildFounderDigestEmail();
  await sendEmail({ to, subject, html });

  return NextResponse.json({ ok: true, sent: true });
}
