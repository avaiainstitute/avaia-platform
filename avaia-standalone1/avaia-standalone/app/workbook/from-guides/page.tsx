import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  confirmSession,
  declineOffer,
  declineSession,
  hostIdentityFrom,
  keepOffer,
  listOfferGroupsForHost,
} from "@/lib/ops/kept-items";

export const metadata = { title: "From your Guides, AVAIA" };
export const dynamic = "force-dynamic";

// A Guide may OFFER something from a session back to you. A Guide never decides what belongs in
// your record. For anything that came through a Guide, you do three things yourself:
//   1. confirm the session was yours (until then you see only who, when and what kind),
//   2. see the item,
//   3. choose "Keep this" (or decline it).
// Only your own Keep creates a kept item in your Workbook. The Guide is never told what you choose.

async function requireHost() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook");
  return hostIdentityFrom(user);
}

function done(message: string, kind: "saved" | "error" = "saved"): never {
  redirect(`/workbook/from-guides?${kind}=${encodeURIComponent(message)}`);
}

async function confirmAction(formData: FormData) {
  "use server";
  const host = await requireHost();
  const r = await confirmSession(host, String(formData.get("sessionId") ?? ""));
  if (!r.ok) done(r.error, "error");
  done("Thank you. You can see what was offered below, and choose what to keep.");
}

async function notMineAction(formData: FormData) {
  "use server";
  const host = await requireHost();
  const r = await declineSession(host, String(formData.get("sessionId") ?? ""));
  if (!r.ok) done(r.error, "error");
  done("Done. Nothing was kept, and it is no longer offered to you.");
}

async function keepAction(formData: FormData) {
  "use server";
  const host = await requireHost();
  const r = await keepOffer(host, String(formData.get("offerId") ?? ""));
  if (!r.ok) done(r.error, "error");
  done("Kept. It is now part of your Workbook.");
}

async function declineAction(formData: FormData) {
  "use server";
  const host = await requireHost();
  const r = await declineOffer(host, String(formData.get("offerId") ?? ""));
  if (!r.ok) done(r.error, "error");
  done("Declined. Nothing was kept.");
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default async function FromGuidesPage({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook");
  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const host = hostIdentityFrom(user);
  const groups = await listOfferGroupsForHost(host);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook" className="label hover:text-seal">
          ← Back to your Workbook
        </Link>
      </p>
      <p className="label mb-3">Your Workbook</p>
      <h1 className="font-serif text-4xl text-ink">From your Guides</h1>
      <p className="mt-4 text-lg text-muted">
        A Guide you worked with can offer you something from your session. It is only an offer. You decide whether it was your session, you see
        what is offered, and nothing becomes part of your Workbook unless you choose Keep this. Your Guide is never told what you choose.
      </p>

      {searchParams?.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>}
      {searchParams?.error && <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>}

      {!host.emailVerified && (
        <p className="mt-8 text-muted">
          Offers are matched to you through a verified email address. Sign in with your email to see anything a Guide has offered.
        </p>
      )}

      {host.emailVerified && groups.length === 0 && <p className="mt-10 text-muted">Nothing has been offered to you.</p>}

      <div className="mt-8 space-y-5">
        {groups.map((g) => (
          <section key={g.sessionId} className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
            <p className="font-serif text-xl text-ink">
              {g.guideName} offered {g.items.length === 1 ? "something" : `${g.items.length} things`}
            </p>
            <p className="mt-1 text-sm text-muted">
              From a {g.toolName} session on {fmtDate(g.sessionDate)}.
            </p>

            {!g.confirmed ? (
              <>
                <p className="mt-3 text-sm text-muted">
                  What is offered: {g.items.map((i) => i.label.toLowerCase()).join(", ")}. You will see the words only after you tell us this session was yours.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={confirmAction}>
                    <input type="hidden" name="sessionId" value={g.sessionId} />
                    <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
                      Yes, this was my session
                    </button>
                  </form>
                  <form action={notMineAction}>
                    <input type="hidden" name="sessionId" value={g.sessionId} />
                    <button type="submit" className="rounded-md border border-rule px-4 py-2 font-sans text-sm text-ink hover:border-seal">
                      This was not me
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <ul className="mt-4 space-y-4">
                  {g.items.map((item) => (
                    <li key={item.offerId} className="rounded-lg border border-rule bg-white/[0.03] p-4">
                      <p className="label text-muted">{item.label}</p>
                      <p className="mt-2 whitespace-pre-wrap font-serif text-lg italic leading-relaxed text-ink">
                        {item.text ? <>&ldquo;{item.text}&rdquo;</> : "This item is no longer available."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {item.text && (
                          <form action={keepAction}>
                            <input type="hidden" name="offerId" value={item.offerId} />
                            <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
                              Keep this
                            </button>
                          </form>
                        )}
                        <form action={declineAction}>
                          <input type="hidden" name="offerId" value={item.offerId} />
                          <button type="submit" className="rounded-md border border-rule px-4 py-2 font-sans text-sm text-ink hover:border-seal">
                            Decline
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
                <form action={notMineAction} className="mt-4">
                  <input type="hidden" name="sessionId" value={g.sessionId} />
                  <button type="submit" className="text-sm text-muted underline hover:text-seal">
                    Decline everything from this session
                  </button>
                </form>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
