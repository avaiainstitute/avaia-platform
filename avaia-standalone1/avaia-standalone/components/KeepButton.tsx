"use client";

import { useState } from "react";

/** "Keep this": the Host's own, intentional choice to carry one item into their
 *  continuing record (kept_items, shown in the Workbook's Kept section). It only ever
 *  fires on the Host's own click and sends just WHICH item; the server reads the text
 *  from the stored record. Nothing is kept automatically. */
export default function KeepButton({
  body,
  className,
}: {
  body: { source: "journey"; conversationId: string; field: string; index: number } | { source: "recognition"; recognitionId: string };
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "kept" | "error">("idle");

  async function keep() {
    setState("pending");
    try {
      const res = await fetch("/api/kept-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(res.ok ? "kept" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "kept") return <span className="text-xs text-muted">Kept in your Workbook</span>;
  return (
    <button
      type="button"
      onClick={keep}
      disabled={state === "pending"}
      className={
        className ??
        "rounded-md border border-rule px-3 py-1 text-xs text-ink transition-colors hover:border-seal disabled:opacity-50"
      }
    >
      {state === "pending" ? "Keeping…" : state === "error" ? "Try again" : "Keep this"}
    </button>
  );
}
