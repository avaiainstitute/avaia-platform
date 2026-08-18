"use client";

import { useState } from "react";

const REASONS: { value: string; label: string }[] = [
  { value: "general", label: "General Inquiry" },
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim() !== "" && email.trim() !== "" && message.trim() !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
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
          Your message has been received. We&rsquo;ll be in touch personally, at the email
          address you provided.
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
          placeholder="Tell us a little about what brought you here."
          className={`${FIELD_CLASSES} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send Message"}
      </button>

      {error && <p className="text-sm text-[#e0857d]">{error}</p>}
    </form>
  );
}
