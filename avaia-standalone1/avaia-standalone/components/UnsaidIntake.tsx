"use client";

import { useState } from "react";

const EXAMPLES = ["Dad", "Mom", "My brother", "My sister", "Someone I lost", "Someone I can't talk to right now"];

export default function UnsaidIntake({ action }: { action: (formData: FormData) => void }) {
  const [recipient, setRecipient] = useState("");

  return (
    <form action={action} className="mt-8">
      <input
        name="recipient"
        type="text"
        required
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Dad, my ex-wife, someone I lost…"
        className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-lg text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setRecipient(ex)}
            className="rounded-full border border-rule px-3 py-1 text-xs text-muted transition-colors hover:border-seal hover:text-ink"
          >
            {ex}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        (Just examples — write it however feels right. Nothing here is a fixed category.)
      </p>

      <details className="mt-8 rounded-lg border border-rule bg-white/[0.03] p-5">
        <summary className="cursor-pointer font-sans text-sm font-medium text-ink">
          Add something that might help ground this conversation (optional)
        </summary>
        <p className="mt-3 text-sm text-muted">
          A memory, something they used to say, how they showed love, a story — anything that
          might help if you later ask for something back. Never required.
        </p>
        <textarea
          name="grounding"
          rows={4}
          placeholder="Optional…"
          className="mt-3 w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
      </details>

      <button
        type="submit"
        disabled={!recipient.trim()}
        className="mt-8 rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Continue
      </button>
    </form>
  );
}
