import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  loadStatusForHost,
  describeEthics,
  describePayment,
  formatDateLabel,
  LIFECYCLE_LABEL,
} from "@/lib/certification-renewal";
import type { GuideCertificationView } from "@/lib/certification-status-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in Guide's own certification status (expiration, days
 *  remaining, CE progress, Ethics, renewal payment). Self-only: the host id
 *  comes from the session, never a parameter, and every table it reads is
 *  RLS self-read. Returns { status: null } for anyone with no certification
 *  (or if the renewal tables are not available yet), which the Account page
 *  treats as "show nothing". */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const s = await loadStatusForHost(supabase, user.id);
  if (!s) return NextResponse.json({ status: null });

  const nextSteps: string[] = [];
  if (s.standing === "active") {
    if (s.renewal.allMet) {
      nextSteps.push("Everything required for renewal is complete. AVAIA confirms renewals.");
    } else {
      nextSteps.push(...s.renewal.blockers);
    }
  } else if (s.standing === "inactive" && s.reactivation) {
    if (s.reactivation.windowOpen) {
      nextSteps.push(...s.reactivation.blockers);
      nextSteps.push("Contact AVAIA to begin reactivation. Your certification record and Program Authorization history are preserved.");
    } else {
      nextSteps.push(...s.reactivation.blockers);
      nextSteps.push("Contact AVAIA about certifying again. Your historical certification record is preserved.");
    }
  } else if (s.standing === "paused" || s.standing === "revoked") {
    nextSteps.push("Contact AVAIA about your certification standing.");
  }

  const view: GuideCertificationView = {
    lifecycle: s.lifecycle,
    lifecycleLabel: LIFECYCLE_LABEL[s.lifecycle],
    standing: s.standing,
    isActive: s.standing === "active",
    certifiedOn: formatDateLabel(s.certifiedAt),
    periodEndsOn: s.cycleEndsAt ? formatDateLabel(s.cycleEndsAt) : null,
    daysRemaining: s.daysRemaining,
    ce: {
      approved: s.ce.approvedInPeriod,
      pending: s.ce.pendingInPeriod,
      required: s.ce.requiredCredits,
      met: s.ce.met,
    },
    ethicsText: describeEthics(s),
    paymentText: describePayment(s),
    paymentStatus: s.payment.status,
    inactive: s.inactivity
      ? {
          monthsInactive: s.inactivity.monthsInactive,
          reactivationWindowEndsOn: formatDateLabel(s.inactivity.windowEndsAt),
          windowOpen: s.inactivity.windowOpen,
        }
      : null,
    nextSteps,
  };

  return NextResponse.json({ status: view });
}
