"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VIRTUE_FAMILIES, VIRTUES, type VirtueFamilyKey } from "@/lib/virtues";
import {
  SECONDARY_LOSS_NAMES,
  JOURNEY_STAGES,
  JOURNEY_STAGE_LABEL,
  PROGRAM_KEYS,
  PROGRAM_LABEL,
  type LibraryEntry,
  type VirtueTag,
  type ContentType,
  type LibraryStatus,
  type LibraryVisibility,
} from "@/lib/library";
import type { Stage, Program } from "@/lib/engine/prompts";

const inputClass =
  "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal";

export default function LibraryEntryForm({ initial }: { initial?: LibraryEntry }) {
  const router = useRouter();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [greatIdea, setGreatIdea] = useState(initial?.great_idea ?? "");
  const [overview, setOverview] = useState(initial?.overview ?? "");
  const [contentType, setContentType] = useState<ContentType>(initial?.content_type ?? "avaia-owned");
  const [body, setBody] = useState(initial?.body ?? "");
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? "");
  const [externalAuthor, setExternalAuthor] = useState(initial?.external_author ?? "");
  const [externalDescription, setExternalDescription] = useState(initial?.external_description ?? "");
  const [status, setStatus] = useState<LibraryStatus>(initial?.status ?? "draft");
  const [visibility, setVisibility] = useState<LibraryVisibility>(initial?.visibility ?? "member");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));

  const [virtues, setVirtues] = useState<VirtueTag[]>(initial?.virtues ?? []);
  const [addFamily, setAddFamily] = useState<VirtueFamilyKey | "">("");
  const [addElement, setAddElement] = useState("");

  const [secondaryLosses, setSecondaryLosses] = useState<string[]>(initial?.secondary_losses ?? []);
  const [journeyStages, setJourneyStages] = useState<Stage[]>(initial?.journey_stages ?? []);
  const [programs, setPrograms] = useState<Program[]>(initial?.programs ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const elements = addFamily ? VIRTUES.filter((v) => v.family === addFamily) : [];

  function addVirtue() {
    if (!addFamily) return;
    setVirtues((v) => [...v, { family: addFamily, element: addElement || null }]);
    setAddFamily("");
    setAddElement("");
  }

  function toggle<T>(list: T[], value: T, setList: (v: T[]) => void) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const payload = {
      title,
      greatIdea,
      overview,
      contentType,
      body: contentType === "avaia-owned" ? body : null,
      externalUrl: contentType === "external-resource" ? externalUrl : null,
      externalAuthor: contentType === "external-resource" ? externalAuthor : null,
      externalDescription: contentType === "external-resource" ? externalDescription : null,
      virtues,
      secondaryLosses,
      journeyStages,
      programs,
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      status,
      visibility,
    };
    try {
      const res = await fetch(
        editing ? `/api/library/entries/${initial!.id}` : "/api/library/entries",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the entry.");
      router.push("/admin/library");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label className="label mb-1 block text-muted">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </div>
      <div>
        <label className="label mb-1 block text-muted">Great Idea / central subject *</label>
        <input value={greatIdea} onChange={(e) => setGreatIdea(e.target.value)} required className={inputClass} />
      </div>
      <div>
        <label className="label mb-1 block text-muted">Overview *</label>
        <textarea value={overview} onChange={(e) => setOverview(e.target.value)} required rows={3} className={inputClass} />
      </div>

      <div>
        <label className="label mb-1 block text-muted">Content type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              checked={contentType === "avaia-owned"}
              onChange={() => setContentType("avaia-owned")}
            />
            AVAIA-owned
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              checked={contentType === "external-resource"}
              onChange={() => setContentType("external-resource")}
            />
            External resource
          </label>
        </div>
      </div>

      {contentType === "avaia-owned" ? (
        <div>
          <label className="label mb-1 block text-muted">Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={inputClass} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label mb-1 block text-muted">External URL</label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </div>
          <div>
            <label className="label mb-1 block text-muted">Author</label>
            <input value={externalAuthor} onChange={(e) => setExternalAuthor(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className="label mb-1 block text-muted">Description</label>
            <textarea
              value={externalDescription}
              onChange={(e) => setExternalDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div>
        <label className="label mb-1 block text-muted">Virtues</label>
        <div className="flex flex-wrap gap-2">
          {virtues.map((v, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full border border-rule px-3 py-1 text-sm text-ink">
              {v.element ? `${v.element} · ${v.family}` : v.family}
              <button
                type="button"
                onClick={() => setVirtues((list) => list.filter((_, ix) => ix !== i))}
                className="text-muted hover:text-ink"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={addFamily}
            onChange={(e) => {
              setAddFamily(e.target.value as VirtueFamilyKey | "");
              setAddElement("");
            }}
            className={inputClass + " w-auto"}
          >
            <option value="">Family…</option>
            {VIRTUE_FAMILIES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            value={addElement}
            onChange={(e) => setAddElement(e.target.value)}
            disabled={!addFamily}
            className={inputClass + " w-auto"}
          >
            <option value="">Element (optional)…</option>
            {elements.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addVirtue}
            disabled={!addFamily}
            className="rounded-md border border-rule px-3 py-2 text-sm text-ink transition-colors hover:border-seal disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <label className="label mb-1 block text-muted">Secondary Losses</label>
        <div className="flex flex-wrap gap-3">
          {SECONDARY_LOSS_NAMES.map((l) => (
            <label key={l} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={secondaryLosses.includes(l)}
                onChange={() => toggle(secondaryLosses, l, setSecondaryLosses)}
              />
              {l}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label mb-1 block text-muted">Journey Stages</label>
        <div className="flex flex-wrap gap-3">
          {JOURNEY_STAGES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={journeyStages.includes(s)}
                onChange={() => toggle(journeyStages, s, setJourneyStages)}
              />
              {JOURNEY_STAGE_LABEL[s]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label mb-1 block text-muted">Programs</label>
        <div className="flex flex-wrap gap-3">
          {PROGRAM_KEYS.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={programs.includes(p)}
                onChange={() => toggle(programs, p, setPrograms)}
              />
              {PROGRAM_LABEL[p]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label mb-1 block text-muted">Tags (comma-separated)</label>
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label mb-1 block text-muted">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as LibraryStatus)} className={inputClass}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="label mb-1 block text-muted">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as LibraryVisibility)}
            className={inputClass}
          >
            <option value="member">Member</option>
            <option value="public">Public</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-[#e0857d]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : editing ? "Save changes" : "Create entry"}
      </button>
    </form>
  );
}
