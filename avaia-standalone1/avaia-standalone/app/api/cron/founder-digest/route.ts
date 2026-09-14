import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { buildFounderDigestEmail } from "@/lib/ops/founder-digest";
import { sendEmail } from "@/lib/resend";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const to = process.env.FOUNDER_DIGEST_EMAIL;
  if (!to) {
    await recordCronRun({
      cronName: "founder-digest",
      startedAt,
      status: "error",
      detail: { reason: "FOUNDER_DIGEST_EMAIL is not set" },
    });
    return NextResponse.json(
      { ok: false, error: "FOUNDER_DIGEST_EMAIL is not set -- nothing sent." },
      { status: 200 }
    );
  }

  try {
    const { subject, html } = await buildFounderDigestEmail();
    await sendEmail({ to, subject, html });
    await recordCronRun({ cronName: "founder-digest", startedAt, status: "success" });
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    // buildFounderDigestEmail/sendEmail previously had no try/catch here at
    // all -- any single query or the send itself throwing meant the digest
    // silently never arrived, with nothing recorded anywhere. This at least
    // leaves a row the next successful run (of any of the three crons) can
    // report on.
    await recordCronRun({
      cronName: "founder-digest",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Founder digest failed to send." }, { status: 500 });
  }
}
