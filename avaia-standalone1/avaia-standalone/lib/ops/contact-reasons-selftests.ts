import "server-only";
import {
  ALWAYS_NEEDS_DORIAN,
  CONTACT_EXTRA_FIELD_KEYS,
  CONTACT_REASON_LABEL,
  CONTEXT_COPY,
  MESSAGE_PLACEHOLDER,
  ORGANIZATION_KINDS,
  PROFESSIONAL_ROLES,
  REFERRAL_KINDS,
  composeContactMessage,
  isContactReason,
} from "@/lib/contact-reasons";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TEST FOR THE CONTACT PATHS (professional referral and organization). Simulated values only: nothing is
// read from or written to the database, and nothing is sent.
//
//   * the contact reasons are the six existing ones plus exactly the two new ones, each with a readable label;
//   * both new reasons always reach the Founder's attention;
//   * the professional roles and the organization inquiry kinds are exactly the approved lists;
//   * the path's fields are validated against those lists and folded, as labelled lines, above the visitor's own
//     words; every other reason's message is stored exactly as written;
//   * each path has its own context line and a placeholder that invites only a general description;
//   * no field asks for a client's name or any private client detail.
//
// The database half (the reason check accepts the two new values and still refuses anything else) is proven by
// schema_rules in lib/ops/system-truth.ts and was proven with a rolled-back test when migration 0125 was applied.

type Case = { name: string; ok: boolean };

function contactCheck(): CheckResult {
  const key = "pipeline_contact_reasons";
  const label = "Contact paths behave as designed";
  try {
    const cases: Case[] = [];

    // Reasons.
    const reasons = Object.keys(CONTACT_REASON_LABEL).sort();
    cases.push({
      name: "the contact reasons are not exactly the six existing plus professional_referral and organization",
      ok:
        reasons.join(",") === ["certification", "general", "guiding", "organization", "other", "professional_referral", "schools", "workshops"].join(",") &&
        reasons.every((r) => isContactReason(r) && CONTACT_REASON_LABEL[r].trim().length > 0),
    });
    cases.push({ name: "an unknown reason was accepted", ok: !isContactReason("professional") && !isContactReason("schools_organizations") && !isContactReason("") && !isContactReason(undefined) });
    cases.push({
      name: "a professional referral or organization inquiry does not always reach the Founder",
      ok: ALWAYS_NEEDS_DORIAN.has("professional_referral") && ALWAYS_NEEDS_DORIAN.has("organization") && !ALWAYS_NEEDS_DORIAN.has("general") && !ALWAYS_NEEDS_DORIAN.has("other"),
    });

    // The lists.
    cases.push({
      name: "the professional roles are not exactly the eight approved",
      ok:
        PROFESSIONAL_ROLES.map((r) => r.label).join("|") ===
        ["Attorney", "CPA / accountant", "Financial advisor", "Insurance professional", "Family office / business advisor", "Hospice / care professional", "Employer / organizational professional", "Other"].join("|"),
    });
    cases.push({
      name: "the organization inquiry kinds are not exactly the four approved",
      ok: ORGANIZATION_KINDS.map((k) => k.label).join("|") === ["Employer / organization", "Professional firm", "Partnership or referral relationship", "Other"].join("|"),
    });
    cases.push({ name: "the referring-or-asking choices are not exactly two", ok: REFERRAL_KINDS.length === 2 });

    // Composition.
    const pro = composeContactMessage(
      "professional_referral",
      { professionalRole: "attorney", referralKind: "referring", contactPreference: "  555-0100,\nafter 3pm  " },
      "A general description."
    );
    cases.push({
      name: "a professional message did not carry its role, referring-or-asking and how to reach them above the visitor's words",
      ok:
        pro.ok &&
        pro.message ===
          "Professional role: Attorney\nReferring or asking: I am referring someone\nHow to reach them: 555-0100, after 3pm\n\nA general description.",
    });
    cases.push({
      name: "a professional message was accepted without a valid role or without referring-or-asking",
      ok:
        !composeContactMessage("professional_referral", { referralKind: "asking" }, "x").ok &&
        !composeContactMessage("professional_referral", { professionalRole: "judge", referralKind: "asking" }, "x").ok &&
        !composeContactMessage("professional_referral", { professionalRole: "attorney" }, "x").ok &&
        !composeContactMessage("professional_referral", { professionalRole: "attorney", referralKind: "someone" }, "x").ok,
    });
    cases.push({
      name: "how to reach them was not optional, or was allowed to run on",
      ok:
        composeContactMessage("professional_referral", { professionalRole: "cpa_accountant", referralKind: "asking" }, "x").ok &&
        !composeContactMessage("professional_referral", { professionalRole: "cpa_accountant", referralKind: "asking", contactPreference: "y".repeat(301) }, "x").ok,
    });
    const org = composeContactMessage("organization", { organizationName: "Acme Co", organizationKind: "professional_firm" }, "We would like to talk.");
    cases.push({
      name: "an organization message did not carry its name and inquiry kind above the visitor's words",
      ok: org.ok && org.message === "Organization or firm: Acme Co\nInquiry kind: Professional firm\n\nWe would like to talk.",
    });
    cases.push({
      name: "an organization message was accepted without a valid kind, or needed a name",
      ok:
        !composeContactMessage("organization", { organizationName: "Acme" }, "x").ok &&
        !composeContactMessage("organization", { organizationKind: "vendor" }, "x").ok &&
        (() => {
          const r = composeContactMessage("organization", { organizationKind: "employer_organization" }, "x");
          return r.ok && r.message === "Inquiry kind: Employer / organization\n\nx";
        })(),
    });
    cases.push({
      name: "another reason's message was changed, or its extra fields were used",
      ok:
        (() => {
          const r = composeContactMessage("general", { professionalRole: "attorney", organizationKind: "professional_firm" }, "Hello there.");
          return r.ok && r.message === "Hello there.";
        })() &&
        (() => {
          const r = composeContactMessage("certification", {}, "What draws me.");
          return r.ok && r.message === "What draws me.";
        })(),
    });

    // Copy, and no private client details.
    cases.push({
      name: "a path's context line is missing, or the general path gained one",
      ok:
        CONTEXT_COPY.professional_referral === "You’re contacting AVAIA about a client or family you support." &&
        CONTEXT_COPY.organization === "You’re contacting AVAIA about your organization, firm, employees, clients or participants." &&
        CONTEXT_COPY.general === undefined,
    });
    cases.push({
      name: "the professional message placeholder does not invite a general description",
      ok: (MESSAGE_PLACEHOLDER.professional_referral ?? "").toLowerCase().includes("general terms"),
    });
    cases.push({
      name: "a field asks for a client's name or other private client detail",
      ok:
        CONTACT_EXTRA_FIELD_KEYS.join(",") === ["professionalRole", "referralKind", "contactPreference", "organizationName", "organizationKind"].join(",") &&
        CONTACT_EXTRA_FIELD_KEYS.every((k) => !/client|patient|beneficiary|ssn|account|diagnos|case/i.test(k)),
    });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated values confirm: the contact reasons are the six existing plus professional_referral and organization, each with a readable label, and the two new ones always reach the Founder; the professional roles and organization inquiry kinds are exactly the approved lists; each path's fields are validated and folded as labelled lines above the visitor's own words while every other reason's message is stored exactly as written; each path has its own context line and a placeholder that invites only a general description; and no field asks for a client's name or private client detail.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function contactReasonsChecks(): CheckResult[] {
  return [contactCheck()];
}
