import Link from "next/link";

export const metadata = { title: "AVAIA Admin" };

export default function AdminIndexPage() {
  return (
    <div>
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink">Operations</h1>
      <div className="mt-8 space-y-3">
        <Link
          href="/admin/guide-candidates"
          className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-opacity hover:opacity-90"
        >
          <p className="font-serif text-lg text-ink">Guide Candidates &amp; Certification Operations</p>
          <p className="mt-1 text-sm text-muted">
            Lifecycle status, derived operational state, and exceptions for every certification candidate.
          </p>
        </Link>
        <Link
          href="/admin/guide-operations"
          className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-opacity hover:opacity-90"
        >
          <p className="font-serif text-lg text-ink">Guide Operations</p>
          <p className="mt-1 text-sm text-muted">
            Certification standing, platform permissions, and access mismatches for every Certified Guide.
          </p>
        </Link>
        <Link
          href="/admin/host-participant-operations"
          className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-opacity hover:opacity-90"
        >
          <p className="font-serif text-lg text-ink">Host / Participant Operations</p>
          <p className="mt-1 text-sm text-muted">
            Onboarding stalls, entitlement blocks, Guide-facilitated participant logistics, and
            Host-scoped access mismatches.
          </p>
        </Link>
      </div>
    </div>
  );
}
