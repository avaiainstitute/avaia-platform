import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { getPinkSnapshot } from "@/lib/pink/ops";
import { pinkDailySummaryEmailHtml } from "@/lib/pink/emails";
import { sendPinkEmail } from "@/lib/pink/mail";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The Pink Shoelace Foundation's own daily summary. Separate from AVAIA's
// Founder Digest (which no longer mentions Pink Shoelace at all). Goes to
// PINK_NOTIFICATION_EMAIL, falling back to CONTACT_NOTIFICATION_EMAIL (the same
// recipient order the Pink contact route already uses).
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const to = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  if (!to) {
    await recordCronRun({
      cronName: "pink-daily-summary",
      startedAt,
      status: "error",
      detail: { reason: "Neither PINK_NOTIFICATION_EMAIL nor CONTACT_NOTIFICATION_EMAIL is set" },
    });
    return NextResponse.json({ ok: false, error: "No Pink Shoelace notification address is set -- nothing sent." }, { status: 200 });
  }

  try {
    const snapshot = await getPinkSnapshot();
    const needs = [...snapshot.problems, ...snapshot.people, ...snapshot.approvals].map((i) => i.text);
    const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const html = pinkDailySummaryEmailHtml({
      dateLabel,
      whatHappened: snapshot.whatHappened,
      needs,
      opportunities: snapshot.opportunities.map((i) => i.text),
    });
    const subject = needs.length > 0 ? `Pink Shoelace Foundation daily summary -- ${needs.length} item(s) need you` : "Pink Shoelace Foundation daily summary";
    await sendPinkEmail({ to, subject, html, context: "daily_summary" });
    await recordCronRun({ cronName: "pink-daily-summary", startedAt, status: "success", detail: { needs: needs.length } });
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    await recordCronRun({
      cronName: "pink-daily-summary",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Pink daily summary failed to send." }, { status: 500 });
  }
}
