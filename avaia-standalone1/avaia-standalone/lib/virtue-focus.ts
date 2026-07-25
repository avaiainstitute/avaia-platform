// Virtue-table focus signalling.
//
// The Guide can end a message with an invisible marker — <<focus: Family | Virtue>>
// — to light up the Chemistry of Virtue table for the Host. This module parses
// that marker out of the streamed/stored text (so the Host never sees it) and
// resolves it to a family key + colour the table can act on. Safe on both the
// server (strip before persisting) and the client (live highlight).

import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";

export type Focus = { family: string; virtue: string | null };
export type ResolvedFocus = {
  familyKey: string;
  familyName: string;
  color: string;
  virtueName: string | null;
};

// Matches a complete marker anywhere in the text.
const MARKER = /<<\s*focus\s*:\s*([^|>]+?)\s*(?:\|\s*([^>]*?)\s*)?>>/gi;

/**
 * Remove every focus marker from `raw` and return the cleaned text plus the LAST
 * focus found. Also trims a marker still mid-stream (an unterminated "<<…") so a
 * partial marker never flashes to the Host during streaming.
 */
export function extractFocus(raw: string): { text: string; focus: Focus | null } {
  let focus: Focus | null = null;
  const re = new RegExp(MARKER.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const family = m[1].trim();
    const virtue = (m[2] ?? "").trim();
    focus = { family, virtue: virtue || null };
  }

  let text = raw.replace(new RegExp(MARKER.source, "gi"), "");

  // Hide a marker still being streamed (an opening "<<" with no closing ">>").
  const open = text.lastIndexOf("<<");
  if (open !== -1 && text.indexOf(">>", open) === -1) {
    text = text.slice(0, open);
  }

  return { text: text.replace(/\s+$/, ""), focus };
}

/** Resolve a raw focus (family/virtue names as the Guide wrote them) to the
 *  family key + colour + canonical virtue name the table uses. Returns null if
 *  the family can't be matched. */
export function resolveFocus(focus: Focus | null): ResolvedFocus | null {
  if (!focus) return null;
  const key = focus.family.toLowerCase();
  const fam = VIRTUE_FAMILIES.find(
    (f) => f.name.toLowerCase() === key || f.key === key
  );
  if (!fam) return null;

  let virtueName: string | null = null;
  if (focus.virtue) {
    const target = focus.virtue.toLowerCase();
    const v = VIRTUES.find((x) => x.name.toLowerCase() === target);
    virtueName = v ? v.name : null;
  }

  return {
    familyKey: fam.key,
    familyName: fam.name,
    color: fam.color,
    virtueName,
  };
}
