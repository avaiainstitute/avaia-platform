"use client";

import { useState } from "react";

// Round 4: Founder Idea Catcher, Decision Keeper, Follow-up Memory, and
// After-Meeting Capture -- one capture form, four kinds. "Parse with AI"
// (follow-up / meeting note only) proposes structured fields from raw
// text for Dorian to review and edit; it never saves anything itself, and
// the raw text he typed is always saved verbatim in `body` regardless of
// whether he uses it. Saving always goes through the ordinary server
// action passed in as `saveAction` -- nothing here calls the database
// directly.

const KIND_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "decision", label: "Decision" },
  { value: "follow_up", label: "Follow-up" },
  { value: "meeting_note", label: "Meeting Note" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "", label: "--" },
  { value: "avaia", label: "AVAIA" },
  { value: "pink_shoelace", label: "Pink Shoelace" },
  { value: "program", label: "Program" },
  { value: "experience", label: "Experience" },
  { value: "website", label: "Website" },
  { value: "future", label: "Future" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

const EXPERIENCE_OPTIONS = [
  { value: "", label: "--" },
  { value: "defying_grief", label: "Defying Grief" },
  { value: "youth_defying_grief", label: "Youth Defying Grief" },
  { value: "workshops_and_speaking", label: "Workshops & Speaking" },
  { value: "chemistry_of_virtue", label: "Chemistry of Virtue" },
  { value: "unsung_heroes", label: "Unsung Heroes" },
  { value: "view_from_above", label: "The View From Above" },
  { value: "other", label: "Other" },
];

type Kind = (typeof KIND_OPTIONS)[number]["value"];

export default function NoteCapture({ saveAction }: { saveAction: (formData: FormData) => void }) {
  const [kind, setKind] = useState<Kind>("idea");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [personName, setPersonName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [relatedExperience, setRelatedExperience] = useState("");
  const [decisionAffectedArea, setDecisionAffectedArea] = useState("");
  const [decisionStatus, setDecisionStatus] = useState("not_started");
  const [source, setSource] = useState<"typed" | "ai_assisted">("typed");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const showPersonFields = kind === "follow_up" || kind === "meeting_note";
  const showDecisionFields = kind === "decision";
  const canParse = (kind === "follow_up" || kind === "meeting_note") && body.trim().length > 0;

  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";

  async function handleParse() {
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/notes/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, rawText: body }),
      });
      if (!res.ok) {
        setParseError("Could not parse this note automatically -- fill in the fields yourself below.");
        return;
      }
      const { extraction } = await res.json();
      if (title.trim() === "") setTitle(extraction.title ?? "");
      setPersonName(extraction.personName ?? "");
      setOrganizationName(extraction.organizationName ?? "");
      setNextAction(extraction.nextAction ?? "");
      setFollowUpDate(extraction.followUpDate ?? "");
      setRelatedExperience(extraction.relatedExperience ?? "");
      if (extraction.category) setCategory(extraction.category);
      setSource("ai_assisted");
    } catch {
      setParseError("Could not parse this note automatically -- fill in the fields yourself below.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <form action={saveAction} className="space-y-3 rounded-lg border border-rule bg-white/[0.04] p-5">
      <div className="flex flex-wrap gap-2">
        {KIND_OPTIONS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              kind === k.value ? "border-seal bg-seal/[0.12] text-ink" : "border-rule text-muted hover:border-seal"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="source" value={source} />

      <div>
        <label className="label mb-1 block text-xs">
          {kind === "idea"
            ? "What's the idea? (in your own words)"
            : kind === "decision"
              ? "What was decided? (in your own words)"
              : kind === "follow_up"
                ? "What happened / what do you need to remember?"
                : "What happened in the meeting? (type or dictate)"}
        </label>
        <textarea
          name="body"
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${fieldClass} resize-none`}
          placeholder={
            kind === "meeting_note"
              ? 'e.g. "Good meeting. They\'re interested in Unsung Heroes for the high school. About 600 students. Their board meets October 12. Call them afterward."'
              : kind === "follow_up"
                ? 'e.g. "I talked to Sarah from the school. She wants me to call her in three weeks."'
                : undefined
          }
        />
      </div>

      {(kind === "follow_up" || kind === "meeting_note") && (
        <div>
          <button
            type="button"
            onClick={handleParse}
            disabled={!canParse || parsing}
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal disabled:opacity-50"
          >
            {parsing ? "Parsing..." : "Parse with AI"}
          </button>
          {parseError && <p className="mt-2 text-xs text-[#e0857d]">{parseError}</p>}
          <p className="mt-1 text-xs text-muted">
            Fills in the fields below for you to review and correct -- nothing is saved until you click Save.
          </p>
        </div>
      )}

      <div>
        <label className="label mb-1 block text-xs">Title</label>
        <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="label mb-1 block text-xs">Category</label>
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value} className="bg-[#05060b] text-ink">
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {showPersonFields && (
          <div>
            <label className="label mb-1 block text-xs">Related AVAIA Experience (optional)</label>
            <select
              name="relatedExperience"
              value={relatedExperience}
              onChange={(e) => setRelatedExperience(e.target.value)}
              className={fieldClass}
            >
              {EXPERIENCE_OPTIONS.map((e) => (
                <option key={e.value} value={e.value} className="bg-[#05060b] text-ink">
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showPersonFields && (
        <>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="label mb-1 block text-xs">Person</label>
              <input
                name="personName"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Organization</label>
              <input
                name="organizationName"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="label mb-1 block text-xs">Follow up on</label>
              <input
                type="date"
                name="followUpDate"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className="label mb-1 block text-xs">What you promised / next action</label>
            <input
              name="nextAction"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className={fieldClass}
            />
          </div>
        </>
      )}

      {showDecisionFields && (
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label mb-1 block text-xs">Affected area/system</label>
            <input
              name="decisionAffectedArea"
              value={decisionAffectedArea}
              onChange={(e) => setDecisionAffectedArea(e.target.value)}
              className={fieldClass}
              placeholder="e.g. Guide certification, Pink participation form"
            />
          </div>
          <div>
            <label className="label mb-1 block text-xs">Implementation status</label>
            <select
              name="decisionImplementationStatus"
              value={decisionStatus}
              onChange={(e) => setDecisionStatus(e.target.value)}
              className={fieldClass}
            >
              <option value="not_started" className="bg-[#05060b] text-ink">not started</option>
              <option value="in_progress" className="bg-[#05060b] text-ink">in progress</option>
              <option value="done" className="bg-[#05060b] text-ink">done</option>
            </select>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="rounded-md bg-seal px-5 py-2.5 text-sm font-semibold text-[#05060b] hover:opacity-90"
      >
        Save
      </button>
    </form>
  );
}
