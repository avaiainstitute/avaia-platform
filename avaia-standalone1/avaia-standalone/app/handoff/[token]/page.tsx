import type { Metadata } from "next";
import HandoffGate from "@/components/HandoffGate";
import { openHandoff, peekHandoff } from "@/lib/ops/coordination-shares";

// THE RECIPIENT'S PAGE (Phase 3, Decision 0010). No account, no sign-in, read-only. It follows the guardian
// consent link's pattern: the page reaches data only through two narrow database functions, never a table.
//
//   * peek_handoff (landing): who shared it and when it ends. Records nothing.
//   * open_handoff (the View click): records the first actual view and returns the frozen copy.
//
// An unknown, expired or revoked link all return exactly the same nothing, so this page never says which.
// Not indexed, no referrer, never cached (a dynamic page is already served no-store), and the site-wide
// anti-framing header already applies.

export const metadata: Metadata = {
  title: "Shared with you, AVAIA",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

function Unavailable() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">This link isn&rsquo;t available</h1>
      <p className="mt-4 text-lg text-muted">If you were expecting something from AVAIA, please ask the person who shared it with you.</p>
    </div>
  );
}

export default async function HandoffPage({ params }: { params: { token: string } }) {
  const token = params.token;

  // Called only when the recipient presses View. This is the only place a view is recorded.
  async function viewAction() {
    "use server";
    const opened = await openHandoff(token);
    return opened ? ({ ok: true, data: opened } as const) : ({ ok: false } as const);
  }

  const landing = await peekHandoff(token);
  if (!landing) return <Unavailable />;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <HandoffGate sharedByName={landing.shared_by_name} expiresAt={landing.expires_at} viewAction={viewAction} />
    </div>
  );
}
