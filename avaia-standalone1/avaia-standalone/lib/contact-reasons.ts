// CONTACT: why a visitor is reaching out, and the short context two of those reasons carry.
//
// The Families & Professional Teams page sends two kinds of visitor to /contact: a professional who is referring
// someone (or asking about AVAIA for a client or family), and an organization, employer or professional firm.
// Each now arrives with its own reason, recorded as a distinct value on the submission, plus a few short, optional
// orientation fields. This is not an intake system, a CRM or a matching tool: the fields are folded into the
// stored message as labelled lines so AVAIA can see, in plain words, who is writing and why. No field asks for a
// client's name or any private client detail.
//
// Pure rules only (no I/O), shared by the form, the route and the System Check self-test.

export type ContactReason =
  | "general"
  | "guiding"
  | "workshops"
  | "schools"
  | "certification"
  | "other"
  | "professional_referral"
  | "organization";

/** The labels AVAIA sees (the notification email, and anywhere a reason is shown). */
export const CONTACT_REASON_LABEL: Record<ContactReason, string> = {
  general: "General Inquiry",
  guiding: "One-on-One Guiding",
  workshops: "Workshops / Groups",
  schools: "Schools / Organizations",
  certification: "Certification",
  other: "Other",
  professional_referral: "Professional referral",
  organization: "Organization / Employer / Professional Firm",
};

export function isContactReason(v: unknown): v is ContactReason {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CONTACT_REASON_LABEL, v);
}

/** Reasons that always reach the Founder's attention, in addition to a crisis or a question in the message. */
export const ALWAYS_NEEDS_DORIAN: ReadonlySet<ContactReason> = new Set<ContactReason>([
  "guiding",
  "workshops",
  "schools",
  "certification",
  "professional_referral",
  "organization",
]);

// ---- The two new paths -------------------------------------------------------------------------

export const PROFESSIONAL_ROLES = [
  { value: "attorney", label: "Attorney" },
  { value: "cpa_accountant", label: "CPA / accountant" },
  { value: "financial_advisor", label: "Financial advisor" },
  { value: "insurance_professional", label: "Insurance professional" },
  { value: "family_office_business_advisor", label: "Family office / business advisor" },
  { value: "hospice_care_professional", label: "Hospice / care professional" },
  { value: "employer_organizational_professional", label: "Employer / organizational professional" },
  { value: "other", label: "Other" },
] as const;

export const REFERRAL_KINDS = [
  { value: "referring", label: "I am referring someone" },
  { value: "asking", label: "I am asking about AVAIA for a client or family" },
] as const;

export const ORGANIZATION_KINDS = [
  { value: "employer_organization", label: "Employer / organization" },
  { value: "professional_firm", label: "Professional firm" },
  { value: "partnership_referral", label: "Partnership or referral relationship" },
  { value: "other", label: "Other" },
] as const;

/** The context line each path shows above its form. */
export const CONTEXT_COPY: Partial<Record<ContactReason, string>> = {
  professional_referral: "You’re contacting AVAIA about a client or family you support.",
  organization: "You’re contacting AVAIA about your organization, firm, employees, clients or participants.",
};

/** Placeholder for the message, which invites a general description and never client details. */
export const MESSAGE_PLACEHOLDER: Partial<Record<ContactReason, string>> = {
  professional_referral: "Tell us, in general terms, what you are hoping AVAIA can help with.",
  organization: "Tell us a little about your organization and what you are looking for.",
};

export const CONTACT_LIMITS = { message: 5000, contactPreference: 300, organizationName: 200 } as const;

/** The extra, optional fields a path may send. Anything not listed here is ignored. */
export type ContactExtras = {
  professionalRole?: unknown;
  referralKind?: unknown;
  contactPreference?: unknown;
  organizationName?: unknown;
  organizationKind?: unknown;
};

export const CONTACT_EXTRA_FIELD_KEYS = ["professionalRole", "referralKind", "contactPreference", "organizationName", "organizationKind"] as const;

const labelFor = (list: readonly { value: string; label: string }[], v: unknown): string | null =>
  typeof v === "string" ? (list.find((x) => x.value === v)?.label ?? null) : null;

/** One short, single-line value: control characters and line breaks become spaces, then trimmed. */
function oneLine(v: unknown, max: number): { ok: true; value: string } | { ok: false } {
  if (v === undefined || v === null || v === "") return { ok: true, value: "" };
  if (typeof v !== "string") return { ok: false };
  const cleaned = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length > max) return { ok: false };
  return { ok: true, value: cleaned };
}

/** Folds the path's own fields, validated against the allowed lists, into labelled lines above the visitor's
 *  message. For every other reason the message is returned exactly as written. */
export function composeContactMessage(
  reason: ContactReason,
  extras: ContactExtras,
  message: string
): { ok: true; message: string } | { ok: false; error: string } {
  if (reason === "professional_referral") {
    const role = labelFor(PROFESSIONAL_ROLES, extras.professionalRole);
    if (!role) return { ok: false, error: "Please choose your professional role." };
    const kind = labelFor(REFERRAL_KINDS, extras.referralKind);
    if (!kind) return { ok: false, error: "Please say whether you are referring someone or asking about AVAIA for a client or family." };
    const reach = oneLine(extras.contactPreference, CONTACT_LIMITS.contactPreference);
    if (!reach.ok) return { ok: false, error: "That is too long. Please shorten how we should reach you." };
    const lines = [`Professional role: ${role}`, `Referring or asking: ${kind}`];
    if (reach.value) lines.push(`How to reach them: ${reach.value}`);
    return { ok: true, message: `${lines.join("\n")}\n\n${message}` };
  }
  if (reason === "organization") {
    const kind = labelFor(ORGANIZATION_KINDS, extras.organizationKind);
    if (!kind) return { ok: false, error: "Please choose the kind of inquiry." };
    const name = oneLine(extras.organizationName, CONTACT_LIMITS.organizationName);
    if (!name.ok) return { ok: false, error: "That organization name is too long." };
    const lines = [`Inquiry kind: ${kind}`];
    if (name.value) lines.unshift(`Organization or firm: ${name.value}`);
    return { ok: true, message: `${lines.join("\n")}\n\n${message}` };
  }
  return { ok: true, message };
}
