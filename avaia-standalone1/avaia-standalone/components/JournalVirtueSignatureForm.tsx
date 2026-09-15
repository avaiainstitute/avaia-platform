"use client";

import { useMemo, useState } from "react";
import { VIRTUE_FAMILIES, virtuesByFamily } from "@/lib/virtues";
import { SIGNATURE_LAYER_LABEL, SIGNATURE_LAYER_ORDER, type SignatureLayer } from "@/lib/virtue-signature-constants";

/** "Journal -> Virtue Signature", entirely the Host's own choice, entirely
 *  the Host's own classification. AVAIA never decides which layer, family,
 *  or element a journal entry demonstrates -- there is no AI call anywhere
 *  in this component. Posts to the existing /api/virtue-signature/add
 *  route unchanged, with sourceType "journal" and sourceReference set to
 *  this entry's own id, exactly the same mechanism WhatBecameVisible.tsx
 *  already uses for a Journey/Unsung Heroes recognition, just without a
 *  pre-classified virtue to offer, since nothing here was ever classified. */
export default function JournalVirtueSignatureForm({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<SignatureLayer>("recognize_in_myself");
  const [familyName, setFamilyName] = useState(VIRTUE_FAMILIES[0].name);
  const [elementName, setElementName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  const familyKey = useMemo(
    () => VIRTUE_FAMILIES.find((f) => f.name === familyName)?.key ?? VIRTUE_FAMILIES[0].key,
    [familyName]
  );
  const elements = useMemo(() => virtuesByFamily(familyKey), [familyKey]);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/virtue-signature/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layer,
          family: familyName,
          element: elementName || null,
          note: note || null,
          sourceType: "journal",
          sourceReference: entryId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not add this to your Signature.");
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (added) {
    return <p className="text-sm text-muted">Added to your Virtue Signature.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
      >
        Add to My Virtue Signature
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-seal/40 bg-seal/[0.06] p-5">
      <p className="label mb-1 text-seal">Add to My Virtue Signature</p>
      <p className="mb-4 text-sm text-muted">
        You decide what this entry says about who you are, not AVAIA. Choose whatever fits.
      </p>

      <div className="space-y-4">
        <div>
          <label className="label mb-2 block" htmlFor="js-layer">
            Which part of your Signature?
          </label>
          <select
            id="js-layer"
            value={layer}
            onChange={(e) => setLayer(e.target.value as SignatureLayer)}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            {SIGNATURE_LAYER_ORDER.map((l) => (
              <option key={l} value={l} className="bg-[#05060b] text-ink">
                {SIGNATURE_LAYER_LABEL[l]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="js-family">
            Virtue Family
          </label>
          <select
            id="js-family"
            value={familyName}
            onChange={(e) => {
              setFamilyName(e.target.value);
              setElementName("");
            }}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            {VIRTUE_FAMILIES.map((f) => (
              <option key={f.key} value={f.name} className="bg-[#05060b] text-ink">
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="js-element">
            Element <span className="text-muted">(optional)</span>
          </label>
          <select
            id="js-element"
            value={elementName}
            onChange={(e) => setElementName(e.target.value)}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="" className="bg-[#05060b] text-ink">
              Just the family, no specific element
            </option>
            {elements.map((v) => (
              <option key={v.name} value={v.name} className="bg-[#05060b] text-ink">
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-2 block" htmlFor="js-note">
            In your own words <span className="text-muted">(optional)</span>
          </label>
          <textarea
            id="js-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this belongs here, if you want to say."
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add to My Signature"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-seal"
        >
          Cancel
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </div>
  );
}
