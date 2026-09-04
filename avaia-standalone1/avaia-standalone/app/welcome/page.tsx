import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsentForm from "@/components/ConsentForm";

export const metadata = { title: "Welcome — AVAIA" };
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: { origin?: string; key?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();

  // A real query error must never be silently treated as "not consented" —
  // that's exactly how the membership_status column being missing on the
  // live database turned into an apparent /journey<->/welcome redirect loop
  // on THIS page's sibling. This page's own query doesn't touch that column,
  // but the same discipline applies to whatever breaks it next.
  if (profileError) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">We couldn&rsquo;t load your profile</h1>
        <p className="mt-4 text-lg text-muted">
          This is a server-side problem, not something to retry your way past. Please let AVAIA
          know what happened.
        </p>
        <p className="mt-3 text-xs text-muted/70">Details: {profileError.message}</p>
      </div>
    );
  }

  // Deliberately NOT `redirect("/journey")` here. /journey redirects here
  // when consent is missing; this page used to redirect back to /journey
  // when consent was present — two server-side redirects that are exact
  // opposites of the same fact. Every fix so far (force-dynamic, hard nav)
  // addressed one possible reason those two reads could disagree, but as
  // long as both directions exist as real redirects, ANY disagreement from
  // ANY cause — including ones not yet found — produces
  // ERR_TOO_MANY_REDIRECTS. A Host who already consented and lands here
  // anyway (bookmark, back button) just gets a link instead of a form; that
  // makes the loop structurally impossible rather than merely unlikely.
  const alreadyConsented = !!profile?.consent_at;

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Welcome</p>
      {alreadyConsented ? (
        <>
          <h1 className="font-serif text-4xl text-ink">You&rsquo;re already set up</h1>
          <p className="mt-4 text-lg text-muted">
            You&rsquo;ve already confirmed the disclaimer below — no need to do it again.
          </p>
          {/* A plain <a>, not next/link's <Link> — every other post-auth-state
              transition in this app had to move off Next's client router onto
              a real navigation to stop serving stale cached pages; this one
              is no different and was missed in the first pass. */}
          <a
            href="/journey"
            className="mt-8 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Continue to your journey
          </a>
        </>
      ) : (
        <>
          <h1 className="font-serif text-4xl text-ink">One thing before we begin</h1>
          <p className="mt-4 text-lg text-muted">
            AVAIA is a guided, virtue-centered conversation — not therapy. Please read
            this and confirm you understand.
          </p>

          {/* IAP orientation, moved here from the separate JourneyIntro gate
           *  that used to appear after consent (components/JourneyIntro.tsx
           *  still has that same content for its stage === "iap" branch --
           *  unchanged, and still shown as a fallback if a Host navigates
           *  back to /journey before ever sending a first message). Consent
           *  becomes the one remaining entry action; see ConsentForm's
           *  ?enter=1 redirect for the plain-/journey destination. */}
          <p className="label mb-2 mt-10">The AVAIA Journey</p>
          <p className="font-serif text-lg text-ink">
            Awareness <span className="text-muted">→</span> Understanding{" "}
            <span className="text-muted">→</span> Agency
          </p>
          <p className="mt-4 text-muted">
            The Journey moves through three connected conversations — three movements within one
            continuing conversation.
          </p>

          <p className="label mb-2 mt-10">1 — Awareness</p>
          <h2 className="font-serif text-3xl text-ink">Individual Awareness Profile</h2>
          <p className="mt-2 font-serif text-lg italic text-muted">What became visible?</p>
          <p className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4 font-serif text-lg leading-relaxed text-ink">
            You don&rsquo;t have to figure out how to talk to me. I will figure out how to listen
            to you.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink">
            The Individual Awareness Profile is where the Journey begins. You can bring what is
            present without needing to organize it first, explain it perfectly, or know where the
            conversation is going.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink">
            Its purpose is not to diagnose, evaluate, or tell you what your experience means. It
            creates room for more of your experience to become visible.
          </p>

          <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
            <p className="leading-relaxed text-ink">
              You remain the owner of your story, meaning, decisions, and participation throughout
              the Journey. AVAIA protects the conditions for awareness, understanding, and
              discernment. It does not determine the outcome for you.
            </p>
          </div>

          <ConsentForm origin={searchParams?.origin} originKey={searchParams?.key} />
        </>
      )}
    </div>
  );
}
