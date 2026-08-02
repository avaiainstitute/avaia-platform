import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROGRAMS } from "@/lib/institution";

export const metadata = { title: "Defying Grief — AVAIA" };
export const dynamic = "force-dynamic";

const PROGRAM = PROGRAMS.find((p) => p.name === "Defying Grief")!;

export default async function DefyingGriefPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in Hosts begin directly; signed-out visitors sign in first, same
  // precedent as the main Journey's own "Begin the journey" link — there's no
  // redirect-back-after-sign-in mechanism anywhere in the app yet, so this
  // isn't a regression, just the existing pattern.
  const beginHref = user ? "/journey?new=1&program=defying-grief" : "/sign-in";

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-4">An AVAIA Program</p>
      <h1 className="font-serif text-5xl leading-tight tracking-[0.12em] text-ink sm:text-6xl">
        Defying Grief
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink">{PROGRAM.blurb}</p>

      <p className="mt-6 max-w-prose text-muted">
        Defying Grief walks the same three-part AVAIA journey — Awareness, Understanding, and
        Discernment — with one addition: as you move into Conversations Across Time, the Guide
        also helps you recognize <em>audacity</em> — the sheer nerve of continuing to live, want,
        try, and feel in the face of loss, however it has shown up for you. Nothing about the free
        first conversation changes; this simply deepens what comes after.
      </p>

      <div className="mt-8">
        <Link
          href={beginHref}
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin
        </Link>
      </div>
    </div>
  );
}
