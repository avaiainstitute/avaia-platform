"use client";

import Link from "next/link";
import { useState } from "react";
import HandoffView from "@/components/HandoffView";
import {
  MAX_VALID_DAYS,
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  SHARE_LIMITS,
  emptyShareInput,
  type FactKey,
  type ShareInput,
} from "@/lib/coordination-shares";
import type { AuthorizeResult, SharePreview } from "@/lib/ops/coordination-shares";

// SHARE WITH, the Host's three steps: choose, preview, authorize. Nothing is pre-selected and nothing is
// chosen for the Host. The preview is the exact page the recipient will see, built on the server from the
// real records; authorization is refused if anything differs from what was previewed. The browser sends
// only the Host's choices and their own typed words.

export type FactOption = { key: FactKey; label: string; value: string };
export type EntryOption = {
  id: string;
  entry_type_label: string;
  source_label: string;
  occurred_at: string;
  excerpt: string;
  host_note: string | null;
};

type PreviewResponse = { ok: true; preview: SharePreview } | { ok: false; error: string };
type AuthorizeResponse = { ok: true; result: AuthorizeResult } | { ok: false; error: string };

const input = "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal";
const option = "bg-[#05060b] text-ink";
const lbl = "label mb-2 block";
const primary =
  "rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50";
const quiet = "rounded-md border border-rule px-5 py-2.5 font-sans text-sm text-ink transition-colors hover:border-seal disabled:opacity-50";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export default function ShareComposer({
  itemId,
  defaultTitle,
  facts,
  entries,
  hasRoomEntries,
  isDecision,
  previewAction,
  authorizeAction,
}: {
  itemId: string;
  defaultTitle: string;
  facts: FactOption[];
  entries: EntryOption[];
  hasRoomEntries: boolean;
  isDecision: boolean;
  previewAction: (input: ShareInput) => Promise<PreviewResponse>;
  authorizeAction: (input: ShareInput, hash: string) => Promise<AuthorizeResponse>;
}) {
  const [form, setForm] = useState<ShareInput>(() => emptyShareInput(defaultTitle));
  const [step, setStep] = useState<"compose" | "preview" | "done">("compose");
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [done, setDone] = useState<AuthorizeResult | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function set<K extends keyof ShareInput>(key: K, value: ShareInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const r = await previewAction(form);
      if (!r.ok) {
        setError(r.error);
      } else {
        setPreview(r.preview);
        setAgreed(false);
        setStep("preview");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onAuthorize() {
    if (pending || !preview || !agreed) return;
    setPending(true);
    setError("");
    try {
      const r = await authorizeAction(form, preview.hash);
      if (!r.ok) {
        setError(r.error);
        // The record may have changed; send the Host back to review rather than leave a stale preview.
        setStep("compose");
        setPreview(null);
      } else {
        setDone(r.result);
        setStep("done");
      }
    } catch {
      setError("Something went wrong, and nothing was confirmed. Please check Share history before trying again.");
    } finally {
      setPending(false);
    }
  }

  if (step === "done" && done) {
    return (
      <div className="rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
        {done.emailStatus === "sent" ? (
          <>
            <h2 className="font-serif text-2xl text-ink">Sent</h2>
            <p className="mt-3 text-ink">
              AVAIA emailed a secure link to {done.recipientEmail}. It is available until {done.expiresOn}. You can revoke it any time from this
              item&rsquo;s Share history.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-ink">Shared, but the email could not be sent</h2>
            <p className="mt-3 text-ink">
              The share exists and is available until {done.expiresOn}. Because AVAIA keeps only a fingerprint of the link, this is the one time you
              will see it. Copy it and deliver it to {done.recipientEmail} yourself, or revoke this share and start again.
            </p>
            <p className="mt-3 break-all rounded-md border border-rule bg-white/[0.04] p-3 font-mono text-sm text-ink">{done.link}</p>
          </>
        )}
        {done.waitingMarked && <p className="mt-3 text-sm text-muted">This item is now marked Waiting.</p>}
        <p className="mt-5">
          <Link href={`/workbook/coordination/${itemId}`} className="text-seal underline-offset-2 hover:underline">
            Back to this item →
          </Link>
        </p>
      </div>
    );
  }

  if (step === "preview" && preview) {
    return (
      <div>
        <h2 className="font-serif text-2xl text-ink">Review exactly what they will see</h2>
        <p className="mt-2 text-sm text-muted">
          This is the page {form.recipient_name} will read. Nothing has been saved or sent yet.
        </p>
        <div className="mt-4 rounded-md border border-rule bg-white/[0.04] p-4 text-sm text-ink">
          <p>
            <span className="text-muted">To: </span>
            {form.recipient_name} ({preview.recipientRoleLabel})
          </p>
          <p>
            <span className="text-muted">Email: </span>
            {preview.recipientEmail}
          </p>
          <p>
            <span className="text-muted">The link lasts: </span>
            {preview.validDays} {preview.validDays === 1 ? "day" : "days"}, until {preview.expiresOn}
          </p>
        </div>

        <div className="mt-6">
          <HandoffView payload={preview.payload} sharedByName={form.shared_by_name} titleTag="h2" />
        </div>

        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
          <p className="label text-seal">Your authorization</p>
          <p className="mt-3 text-ink">{preview.statement}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span className="text-ink">I authorize this share.</span>
          </label>
          {preview.waitingPossible && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={form.mark_waiting} onChange={(e) => set("mark_waiting", e.target.checked)} />
              <span className="text-ink">Also mark this item as Waiting on {preview.waitingLabel.toLowerCase()}.</span>
            </label>
          )}
        </div>

        {error && <p className="mt-4 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={quiet} disabled={pending} onClick={() => setStep("compose")}>
            Back to edit
          </button>
          <button type="button" className={primary} disabled={pending || !agreed} onClick={onAuthorize}>
            {pending ? "Sending…" : "Authorize and send"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onPreview} className="space-y-8">
      {error && <p className="rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{error}</p>}

      <section className="space-y-5">
        <h2 className="font-serif text-2xl text-ink">Who is it for?</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={lbl} htmlFor="sc-name">Their name</label>
            <input id="sc-name" className={input} maxLength={SHARE_LIMITS.name} value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} />
          </div>
          <div>
            <label className={lbl} htmlFor="sc-email">Their email</label>
            <input id="sc-email" type="email" className={input} maxLength={SHARE_LIMITS.email} value={form.recipient_email} onChange={(e) => set("recipient_email", e.target.value)} />
          </div>
          <div>
            <label className={lbl} htmlFor="sc-role">Their role</label>
            <select id="sc-role" className={input} value={form.recipient_role} onChange={(e) => set("recipient_role", e.target.value as ShareInput["recipient_role"])}>
              {RECIPIENT_ROLES.map((r) => (
                <option key={r} value={r} className={option}>{RECIPIENT_ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="sc-rolelabel">
              Their role, in your words {form.recipient_role === "other" ? "(required)" : "(optional)"}
            </label>
            <input id="sc-rolelabel" className={input} maxLength={SHARE_LIMITS.roleLabel} placeholder="for example, estate attorney" value={form.recipient_role_label} onChange={(e) => set("recipient_role_label", e.target.value)} />
          </div>
          <div>
            <label className={lbl} htmlFor="sc-by">The name you want them to see</label>
            <input id="sc-by" className={input} maxLength={SHARE_LIMITS.name} value={form.shared_by_name} onChange={(e) => set("shared_by_name", e.target.value)} />
          </div>
          <div>
            <label className={lbl} htmlFor="sc-days">How long the link lasts (days, 1 to {MAX_VALID_DAYS})</label>
            <input id="sc-days" type="number" min={1} max={MAX_VALID_DAYS} className={input} value={form.valid_days} onChange={(e) => set("valid_days", Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={lbl} htmlFor="sc-purpose">Why you are sharing this (required)</label>
          <textarea id="sc-purpose" rows={2} className={input} maxLength={SHARE_LIMITS.purpose} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
        </div>
        <div>
          <label className={lbl} htmlFor="sc-title">Title they will see</label>
          <input id="sc-title" className={input} maxLength={SHARE_LIMITS.title} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-serif text-2xl text-ink">What do you want to share?</h2>
        <p className="text-sm text-muted">Nothing is chosen for you. Only what you tick or write below goes in. The next step shows exactly what they will see.</p>

        {facts.length > 0 && (
          <div>
            <p className={lbl}>Details about this item</p>
            <ul className="space-y-2">
              {facts.map((f) => (
                <li key={f.key}>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={form.fact_keys.includes(f.key)} onChange={() => set("fact_keys", toggle(form.fact_keys, f.key))} />
                    <span className="text-ink">
                      <span className="text-muted">{f.label}: </span>
                      {f.value}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isDecision && (
          <div>
            <p className={lbl}>Entries from your record</p>
            {entries.length === 0 ? (
              <p className="text-sm text-muted">There are no active entries to share.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map((en) => (
                  <li key={en.id} className="rounded-lg border border-rule bg-white/[0.03] p-3">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" className="mt-1" checked={form.entry_ids.includes(en.id)} onChange={() => set("entry_ids", toggle(form.entry_ids, en.id))} />
                      <span className="text-ink">
                        <span className="text-seal">{en.entry_type_label}</span>
                        <span className="text-muted"> · {en.source_label} · {fmtDate(en.occurred_at)}</span>
                        <span className="mt-1 block whitespace-pre-wrap font-serif italic">{en.excerpt}</span>
                        {en.host_note && <span className="mt-1 block text-muted">Your note: {en.host_note}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {hasRoomEntries && <p className="mt-2 text-xs text-muted">Words from a Shared Room can&rsquo;t be shared outside AVAIA, so they are not listed. Withdrawn entries are not listed either.</p>}
          </div>
        )}

        <div>
          <label className={lbl} htmlFor="sc-summary">Your summary (optional)</label>
          <textarea id="sc-summary" rows={3} className={input} maxLength={SHARE_LIMITS.longText} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </div>
        <div>
          <label className={lbl} htmlFor="sc-questions">Open questions (optional)</label>
          <textarea id="sc-questions" rows={3} className={input} maxLength={SHARE_LIMITS.longText} value={form.open_questions} onChange={(e) => set("open_questions", e.target.value)} />
        </div>
        <div>
          <label className={lbl} htmlFor="sc-follow">What you are asking them to do (optional)</label>
          <textarea id="sc-follow" rows={3} className={input} maxLength={SHARE_LIMITS.longText} value={form.requested_follow_up} onChange={(e) => set("requested_follow_up", e.target.value)} />
        </div>
        <div>
          <label className={lbl} htmlFor="sc-reach">How to reach you (optional)</label>
          <textarea id="sc-reach" rows={2} className={input} maxLength={SHARE_LIMITS.howToReach} value={form.how_to_reach} onChange={(e) => set("how_to_reach", e.target.value)} />
        </div>
      </section>

      <div>
        <button type="submit" className={primary} disabled={pending}>
          {pending ? "Preparing…" : "Preview what they will see"}
        </button>
      </div>
    </form>
  );
}
