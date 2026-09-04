import "server-only";
import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";
import { getViewFromAboveClass } from "@/lib/view-from-above";

// Resolves a Host's entry point into a private AVAIA conversation --
// "I clicked this specific Chemistry element" or "I just took this
// specific View From Above class" -- into structured context the IAP
// engine can use to open naturally. `source`/`key` come from a URL
// query string a Host clicked through on (see app/chemistry/page.tsx,
// app/chemistry/family/page.tsx, app/view-from-above/[slug]/page.tsx),
// which is untrusted input -- this function is the one place that
// input is resolved against AVAIA's own canonical data (lib/virtues.ts,
// lib/view-from-above.ts) rather than ever being used directly. An
// unrecognized key returns null (no origin context at all) rather than
// inventing or passing through anything -- fails closed, never fails
// open into fabricated content.

export type OriginContext = {
  source: "chemistry" | "view-from-above";
  label: string; // the element name, or the class title
  family: string; // Virtue Family display name either way
  definition: string; // canonical element definition, or the class's human question
};

export function resolveOriginContext(source: string | undefined, key: string | undefined): OriginContext | null {
  if (!source || !key) return null;

  if (source === "chemistry") {
    const virtue = VIRTUES.find((v) => v.name.toLowerCase() === key.toLowerCase());
    if (!virtue) return null;
    const family = VIRTUE_FAMILIES.find((f) => f.key === virtue.family);
    if (!family) return null;
    return {
      source: "chemistry",
      label: virtue.name,
      family: family.name,
      definition: virtue.definition,
    };
  }

  if (source === "view-from-above") {
    const cls = getViewFromAboveClass(key);
    if (!cls) return null;
    return {
      source: "view-from-above",
      label: cls.title,
      family: cls.virtueFamily,
      definition: cls.humanQuestion,
    };
  }

  return null;
}
