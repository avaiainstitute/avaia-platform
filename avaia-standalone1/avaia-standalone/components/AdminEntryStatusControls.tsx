"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryStatus } from "@/lib/library";

export default function AdminEntryStatusControls({
  entryId,
  status,
}: {
  entryId: string;
  status: LibraryStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: LibraryStatus) {
    if (busy || next === status) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/library/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <button
          type="button"
          onClick={() => setStatus("published")}
          disabled={busy}
          className="rounded-full border border-seal px-3 py-1 text-xs text-seal transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Publish
        </button>
      )}
      {status === "published" && (
        <button
          type="button"
          onClick={() => setStatus("draft")}
          disabled={busy}
          className="rounded-full border border-rule px-3 py-1 text-xs text-muted transition-colors hover:border-seal disabled:opacity-50"
        >
          Unpublish
        </button>
      )}
      {status !== "archived" && (
        <button
          type="button"
          onClick={() => setStatus("archived")}
          disabled={busy}
          className="rounded-full border border-rule px-3 py-1 text-xs text-muted transition-colors hover:border-seal disabled:opacity-50"
        >
          Archive
        </button>
      )}
    </div>
  );
}
