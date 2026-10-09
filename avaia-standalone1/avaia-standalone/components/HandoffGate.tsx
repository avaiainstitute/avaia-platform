"use client";

import { useState } from "react";
import HandoffView from "@/components/HandoffView";
import { formatLongDate } from "@/lib/coordination-shares";
import type { OpenedHandoff } from "@/lib/ops/coordination-shares";

// THE RECIPIENT'S CLICK-TO-OPEN. The landing page shows only who shared something and when it ends. The
// content appears, and the first view is recorded, only when the recipient chooses View. That is what keeps
// an email link scanner or a preview pane from counting as a view. After the click, the frozen copy is
// shown read-only. There is nothing else to do here: no reply, no account, no upload.

type ViewResponse = { ok: true; data: OpenedHandoff } | { ok: false };

export default function HandoffGate({
  sharedByName,
  expiresAt,
  viewAction,
}: {
  sharedByName: string;
  expiresAt: string;
  viewAction: () => Promise<ViewResponse>;
}) {
  const [state, setState] = useState<"idle" | "pending" | "open" | "unavailable">("idle");
  const [data, setData] = useState<OpenedHandoff | null>(null);

  async function onView() {
    if (state === "pending") return;
    setState("pending");
    try {
      const r = await viewAction();
      if (r.ok) {
        setData(r.data);
        setState("open");
      } else {
        setState("unavailable");
      }
    } catch {
      setState("unavailable");
    }
  }

  if (state === "open" && data) {
    return (
      <HandoffView
        payload={data.payload}
        sharedByName={data.shared_by_name}
        authorizedAt={data.authorized_at}
        expiresAt={data.expires_at}
        titleTag="h1"
      />
    );
  }

  if (state === "unavailable") {
    return (
      <div>
        <h1 className="font-serif text-4xl text-ink">This link isn&rsquo;t available</h1>
        <p className="mt-4 text-lg text-muted">If you were expecting something from AVAIA, please ask the person who shared it with you.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="label mb-3">AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">{sharedByName} has shared something with you</h1>
      <p className="mt-4 text-lg text-muted">
        It is a read-only copy, and it is available until {formatLongDate(expiresAt)}. Nothing is shown until you choose View.
      </p>
      <p className="mt-6">
        <button
          type="button"
          onClick={onView}
          disabled={state === "pending"}
          className="rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state === "pending" ? "Opening…" : "View"}
        </button>
      </p>
    </div>
  );
}
