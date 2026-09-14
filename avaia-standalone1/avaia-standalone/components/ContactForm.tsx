"use client";

import { useEffect, useState } from "react";
import {
  EXPERIENCE_TYPES,
  EXPERIENCE_LABEL,
  GROUP_TYPES,
  GROUP_TYPE_LABEL,
  type ExperienceType,
  type GroupType,
} from "@/lib/experiences-agent";

// "Bring a Program/Experience to My Group" is Contact's one doorway into
// the existing Agent 8 intake (previously its own /experiences page and
// top-level nav item, now consolidated here per the site's single-Contact
// navigation). Selecting it swaps the rest of the form to the
// experience-inquiry fields and posts to /api/experiences/inquiry
// (unchanged, still its own table/notification) instead of /api/contact --
// every other reason keeps today's exact plain-message behavior.
const REASONS: { value: string; label: string }[] = [
  { value: "general", label: "General Inquiry" },
  { value: "bring_a_program", label: "Bring a Program/Experience to My Group" },
  { value: "guiding", label: "One-on-One Guiding" },
  { value: "workshops", label: "Workshops / Groups" },
  { value: "schools", label: "Schools / Organizations" },
  { value: "certification", label: "Certification" },
  { value: "other", label: "Other" },
];

const FIELD_CLASSES =
  "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("general");
  const [message, setMessage] = useState("");
  // Bring-a-Program fields only, mirrors the former ExperienceInquiryForm.
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("school");
  const [approxGroupSize, setApproxGroupSize] = useState("");
  const [location, setLocation] = useState("");
  const [experienceInterest, setExperienceInterest] = useState<ExperienceType>("defying_grief");
  const [requestDetails, setRequestDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const isBringAProgram = reason === "bring_a_program";
  const canSubmit =
    name.trim() !== "" && email.trim() !== "" && (isBringAProgram || message.trim() !== "");

  // Pre-select the reason from ?reason=... when it's a genuine, already-
  // supported value (e.g. /certified-guide's CTA links to
  // /contact?reason=certification, and the former /experiences page now
  // redirects to /contact?reason=bring_a_program), never trusted as-is,
  // only ever set to one of REASONS' own existing values. Read via a plain
  // client-side effect (not next/navigation's useSearchParams) specifically
  // so the server-rendered/first-paint markup always matches today's
  // "general" default, no Suspense boundary needed, no hydration mismatch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("reason");
    if (param && REASONS.some((r) => r.value === param)) {
      setReason(param);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = isBringAProgram
        ? await fetch("/api/experiences/inquiry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              email,
              phone,
              organizationName,
              groupType,
              approxGroupSize,
              location,
              experienceInterest,
              requestDetails,
            }),
          })
        : await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, reason, message }),
          });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Could not send your message.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-10 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-6">
        <p className="font-serif text-xl text-ink">Thank you for reaching out.</p>
        <p className="mt-2 text-muted">
          {isBringAProgram
            ? "Your inquiry has been received. Dorian will follow up personally to talk through what would fit your group."
            : "Your message has been received. We’ll be in touch personally, at the email address you provided."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-5">
      <div>
        <label className="label mb-2 block" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD_CLASSES}
        />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={FIELD_CLASSES}
        />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor="reason">
          Reason for contacting AVAIA
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={FIELD_CLASSES}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value} className="bg-[#05060b] text-ink">
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {isBringAProgram ? (
        <>
          <div>
            <label className="label mb-2 block" htmlFor="phone">
              Phone <span className="text-muted">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="organizationName">
              Organization / Group Name <span className="text-muted">(optional)</span>
            </label>
            <input
              id="organizationName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="groupType">
              Type of Group
            </label>
            <select
              id="groupType"
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as GroupType)}
              className={FIELD_CLASSES}
            >
              {GROUP_TYPES.map((g) => (
                <option key={g} value={g} className="bg-[#05060b] text-ink">
                  {GROUP_TYPE_LABEL[g]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="approxGroupSize">
              Approximate Group Size <span className="text-muted">(optional)</span>
            </label>
            <input
              id="approxGroupSize"
              type="text"
              value={approxGroupSize}
              onChange={(e) => setApproxGroupSize(e.target.value)}
              placeholder="e.g. 20-30 people"
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="location">
              Location <span className="text-muted">(optional)</span>
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State"
              className={FIELD_CLASSES}
            />
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="experienceInterest">
              What are you interested in bringing to your group?
            </label>
            <select
              id="experienceInterest"
              value={experienceInterest}
              onChange={(e) => setExperienceInterest(e.target.value as ExperienceType)}
              className={FIELD_CLASSES}
            >
              {EXPERIENCE_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#05060b] text-ink">
                  {EXPERIENCE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label mb-2 block" htmlFor="requestDetails">
              Tell us more about what you&rsquo;re looking for{" "}
              <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="requestDetails"
              rows={5}
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              placeholder="What brought you here, and what would be most helpful for your group?"
              className={`${FIELD_CLASSES} resize-none`}
            />
          </div>
        </>
      ) : (
        <div>
          <label className="label mb-2 block" htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              reason === "certification"
                ? "What draws you to Guide work, and how do you imagine using AVAIA?"
                : "Tell us a little about what brought you here."
            }
            className={`${FIELD_CLASSES} resize-none`}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Sending…" : isBringAProgram ? "Send Inquiry" : "Send Message"}
      </button>

      {error && <p className="text-sm text-[#e0857d]">{error}</p>}
    </form>
  );
}
