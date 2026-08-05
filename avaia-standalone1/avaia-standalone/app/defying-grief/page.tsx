import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import {
  loadDefyingGriefDashboard,
  DEFYING_GRIEF_PROGRAM_NAME,
} from "@/lib/defying-grief";

export const metadata = { title: `${DEFYING_GRIEF_PROGRAM_NAME} — AVAIA` };
export const dynamic = "force-dynamic";

export default async function DefyingGriefPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <DefyingGriefIntro />;

  const dashboard = await loadDefyingGriefDashboard(supabase, user.id);

  const header = (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/workbook"
          className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
        >
          Workbook
        </Link>
        <SignOutButton />
      </div>
    </div>
  );

  if (!dashboard.started) {
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {header}
        <p className="label mt-8 mb-2">Dorian&rsquo;s second guided program</p>
        <h1 className="font-serif text-4xl text-ink">{DEFYING_GRIEF_PROGRAM_NAME}</h1>
        <p className="mt-4 text-lg text-muted">
          A guided path through grief, held with the same care as the AVAIA Journey —
          Individual Awareness Profile, Conversations Across Time: The Audacity of Grief, and
          InnerCompass: The Audacity of Happiness, walked as one continuous program.
        </p>
        <div className="mt-8">
          <Link
            href="/journey?new=1&program=defying-grief"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Begin Defying Grief
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {header}

      <p className="label mt-8 mb-2">Dorian&rsquo;s guided program</p>
      <h1 className="font-serif text-4xl text-ink">{DEFYING_GRIEF_PROGRAM_NAME}</h1>

      {dashboard.roomIdentity && (
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4">
          <p className="font-sans text-xs uppercase tracking-wide text-muted">
            Room Identity — what emerged from your own conversation
          </p>
          <p className="mt-1 font-serif text-lg text-ink">{dashboard.roomIdentity}</p>
        </div>
      )}

      <ol className="mt-8 space-y-3">
        {dashboard.stages.map((s) => (
          <li
            key={s.stage}
            className="flex items-center justify-between rounded-lg border border-rule px-5 py-4"
          >
            <div>
              <p className="font-serif text-lg text-ink">{s.label}</p>
              <p className="mt-1 font-sans text-xs uppercase tracking-wide text-muted">
                {s.statusCopy}
              </p>
            </div>
            {s.href && (
              <Link
                href={s.href}
                className="inline-block shrink-0 rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
              >
                {s.status === "complete" ? "View" : "Continue"}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Shown to visitors who aren't signed in — the invitation to begin. */
function DefyingGriefIntro() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-4">Dorian&rsquo;s second guided program</p>
      <h1 className="font-serif text-4xl text-ink sm:text-5xl">{DEFYING_GRIEF_PROGRAM_NAME}</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink">
        A guided path through grief, held with the same care as the AVAIA Journey — Individual
        Awareness Profile, Conversations Across Time: The Audacity of Grief, and InnerCompass: The
        Audacity of Happiness, walked as one continuous program.
      </p>
      <div className="mt-8">
        <Link
          href="/sign-in"
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin
        </Link>
      </div>
    </div>
  );
}
