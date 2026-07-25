import Link from "next/link";
import { notFound } from "next/navigation";
import { CONVERSATIONS, conversation } from "@/lib/institution";

export function generateStaticParams() {
  return CONVERSATIONS.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const c = conversation(params.slug);
  return { title: c ? `${c.name} — AVAIA` : "AVAIA" };
}

function SpecList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="label mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-ink">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-seal" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ConversationPage({ params }: { params: { slug: string } }) {
  const c = conversation(params.slug);
  if (!c) notFound();

  const next = c.referralTo ? conversation(c.referralTo) : undefined;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <Link href="/" className="label hover:text-seal">
        ← The Constitution
      </Link>

      <p className="label mb-2 mt-8">{c.position}</p>
      <h1 className="font-serif text-4xl text-ink">
        {c.name}
        {c.abbr && <span className="ml-3 text-2xl text-muted">{c.abbr}</span>}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">{c.purpose}</p>

      {(c.hostDoes || c.exampleQuestion) && (
        <div className="mt-8 rounded-lg border-l-4 border-seal bg-white/[0.06] backdrop-blur-sm px-5 py-4">
          {c.hostDoes && (
            <p className="text-ink">
              <span className="label mr-2">What the Host does</span>
              {c.hostDoes}
            </p>
          )}
          {c.exampleQuestion && (
            <p className="mt-2 font-serif text-lg italic text-seal">
              “{c.exampleQuestion}”
            </p>
          )}
        </div>
      )}

      <div className="mt-12 space-y-10">
        <SpecList title="Primary Objectives" items={c.objectives} />
        {c.structure && <SpecList title="Conversation Structure" items={c.structure} />}
        <div className="grid gap-10 sm:grid-cols-2">
          <SpecList title="Inputs" items={c.inputs} />
          <SpecList title="Outputs" items={c.outputs} />
        </div>
        <div>
          <p className="label mb-3">Boundaries</p>
          <ul className="space-y-2">
            {c.boundaries.map((b) => (
              <li key={b} className="flex gap-3 text-muted">
                <span className="mt-0.5 shrink-0 font-sans text-sm">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rule-t mt-12 border-t border-rule pt-6">
        <p className="label mb-2">Referral — what carries forward</p>
        {c.carriesForward && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {c.carriesForward.map((item) => (
              <li
                key={item}
                className="rounded-full border border-rule bg-white/[0.04] backdrop-blur-sm px-3 py-1 text-sm text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
        {next ? (
          <Link
            href={`/conversations/${next.slug}`}
            className="font-serif text-xl text-seal hover:underline"
          >
            {next.name} →
          </Link>
        ) : (
          c.referralTo === "workbook" && (
            <p className="font-serif text-xl text-ink">Recorded in the Workbook →</p>
          )
        )}
      </div>
    </div>
  );
}
