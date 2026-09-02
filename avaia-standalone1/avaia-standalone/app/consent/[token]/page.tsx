import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConfirmConsentButton from "@/components/ConfirmConsentButton";

export const metadata = { title: "Guardian Consent — AVAIA" };
export const dynamic = "force-dynamic";

/** The guardian-facing half of the stronger consent pathway
 *  (verification_method: 'guardian_link_confirmed', see
 *  lib/guardian-consent.ts and migration 0043). No login -- a guardian
 *  never has an AVAIA account. Reads through the narrow SECURITY DEFINER
 *  function get_pending_consent_by_token, which returns only a pending
 *  row matching this exact token and nothing else; confirming calls
 *  confirm_pending_consent, which can only ever flip that one row from
 *  pending to active. A guardian visiting an already-confirmed or
 *  unknown link sees a plain, honest state -- never an error that implies
 *  something is broken. */
type PendingConsent = {
  id: string;
  guardian_name: string | null;
  disclosure_text: string;
  scope: string;
  status: string;
};

export default async function GuardianConsentPage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("get_pending_consent_by_token", { p_token: params.token })
    .maybeSingle<PendingConsent>();

  if (error) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">We couldn&rsquo;t load this</h1>
        <p className="mt-4 text-lg text-muted">
          This is a server-side problem, not something to retry your way past.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">AVAIA</p>
        <h1 className="font-serif text-4xl text-ink">This link isn&rsquo;t active</h1>
        <p className="mt-4 text-lg text-muted">
          Either this consent has already been confirmed, or this link is no longer valid. If you
          were expecting to confirm a Youth Defying Grief participation for someone in your care,
          reach out to their Guide directly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">AVAIA</p>
      <h1 className="font-serif text-4xl text-ink">Guardian Consent</h1>
      <p className="mt-4 text-lg text-muted">
        You&rsquo;re being asked to give permission for <span className="text-ink">{data.guardian_name ? "a young person in your care" : "a young person"}</span> to
        participate in Youth Defying Grief.
      </p>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-6 text-ink backdrop-blur-sm">
        <p className="whitespace-pre-line leading-relaxed">{data.disclosure_text}</p>
      </div>

      <p className="mt-6 text-sm text-muted">
        Confirming below authorizes participation only. It does not give you access to what this
        young person says privately in their own AVAIA conversation — that stays theirs.
      </p>

      <ConfirmConsentButton token={params.token} />
    </div>
  );
}
