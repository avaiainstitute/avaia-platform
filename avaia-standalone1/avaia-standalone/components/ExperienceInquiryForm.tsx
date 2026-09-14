"use client";

import { useState } from "react";
import {
  EXPERIENCE_TYPES,
  EXPERIENCE_LABEL,
  GROUP_TYPES,
  GROUP_TYPE_LABEL,
  type ExperienceType,
  type GroupType,
} from "@/lib/experiences-agent";

const FIELD_CLASSES =
  "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal";

export default function ExperienceInquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  const canSubmit = name.trim() !== "" && email.trim() !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/experiences/inquiry", {
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
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error || "Could not send your inquiry.");
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
          Your inquiry has been received. Dorian will follow up personally to talk through what
          would fit your group.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-5">
      <div>
        <label className="label mb-2 block" htmlFor="name">
          Your Name
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
          Tell us more about what you&rsquo;re looking for
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

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send Inquiry"}
      </button>

      {error && <p className="text-sm text-[#e0857d]">{error}</p>}
    </form>
  );
}
