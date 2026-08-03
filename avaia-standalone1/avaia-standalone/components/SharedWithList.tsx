"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SharedAccessGrantWithEmail } from "@/lib/sharing";

export default function SharedWithList({ grants }: { grants: SharedAccessGrantWithEmail[] }) {
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function revoke(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/share/${id}`, { method: "PATCH" });
      if (res.ok) router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  if (grants.length === 0) {
    return <p className="text-sm text-muted">Nothing shared yet.</p>;
  }

  return (
    <div className="space-y-2">
      {grants.map((g) => (
        <div
          key={g.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
        >
          <div>
            <p className="text-sm text-ink">{g.shared_with_email ?? "Pending"}</p>
            <p className="text-xs text-muted">
              {g.scope === "workbook" ? "Entire Workbook" : "One conversation"} · granted{" "}
              {new Date(g.granted_at).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => revoke(g.id)}
            disabled={revokingId === g.id}
            className="rounded-md border border-rule px-3 py-1.5 text-xs text-muted transition-colors hover:border-seal hover:text-ink disabled:opacity-50"
          >
            {revokingId === g.id ? "Revoking…" : "Revoke"}
          </button>
        </div>
      ))}
    </div>
  );
}
