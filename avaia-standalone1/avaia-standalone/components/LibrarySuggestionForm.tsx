"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VIRTUE_FAMILIES, VIRTUES, type VirtueFamilyKey } from "@/lib/virtues";
import { SECONDARY_LOSS_NAMES, PROGRAM_KEYS, PROGRAM_LABEL } from "@/lib/library";

export default function LibrarySuggestionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [whyRelevant, setWhyRelevant] = useState("");
  const [virtueFamily, setVirtueFamily] = useState<VirtueFamilyKey | "">("");
  const [virtueName, setVirtueName] = useState("");
  const [secondaryLoss, setSecondaryLoss] = useState("");
  const [program, setProgram] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const elements = virtueFamily ? VIRTUES.filter((v) => v.family === virtueFamily) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/library/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          link,
          description,
          whyRelevant,
          suggestedVirtueFamily: virtueFamily || null,
          suggestedVirtueName: virtueName || null,
          suggestedSecondaryLoss: secondaryLoss || null,
          suggestedProgram: program || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit the suggestion.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-6">
        <p className="font-serif text-lg text-seal">Thank you.</p>
        <p className="mt-2 text-ink">Your suggestion is in the review queue.</p>
        <button
          type="button"
          onClick={() => router.push("/library")}
          className="mt-4 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal";

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label className="label mb-1 block text-muted">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label mb-1 block text-muted">Author</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="label mb-1 block text-muted">Link</label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="label mb-1 block text-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </div>
      <div>
        <label className="label mb-1 block text-muted">Why it&rsquo;s relevant *</label>
        <textarea
          value={whyRelevant}
          onChange={(e) => setWhyRelevant(e.target.value)}
          required
          rows={3}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label mb-1 block text-muted">Suggested virtue family</label>
          <select
            value={virtueFamily}
            onChange={(e) => {
              setVirtueFamily(e.target.value as VirtueFamilyKey | "");
              setVirtueName("");
            }}
            className={inputClass}
          >
            <option value="">None</option>
            {VIRTUE_FAMILIES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1 block text-muted">Suggested element</label>
          <select
            value={virtueName}
            onChange={(e) => setVirtueName(e.target.value)}
            disabled={!virtueFamily}
            className={inputClass}
          >
            <option value="">None</option>
            {elements.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label mb-1 block text-muted">Suggested Secondary Loss</label>
          <select value={secondaryLoss} onChange={(e) => setSecondaryLoss(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {SECONDARY_LOSS_NAMES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1 block text-muted">Suggested program</label>
          <select value={program} onChange={(e) => setProgram(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {PROGRAM_KEYS.map((p) => (
              <option key={p} value={p}>
                {PROGRAM_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-[#e0857d]">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {sending ? "Submitting…" : "Submit suggestion"}
      </button>
    </form>
  );
}
