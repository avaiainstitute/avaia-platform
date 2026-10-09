import { GOVERNING_STATEMENT } from "@/lib/coordination-entries";
import { FACT_KEYS, formatLongDate, type HandoffPayload } from "@/lib/coordination-shares";
import { DISCLAIMER } from "@/lib/safety";

// THE HANDOFF, AS THE RECIPIENT SEES IT. One renderer for three places: the Host's preview before they
// authorize, the Host's Share History (the frozen copy exactly as sent), and the recipient's page. It
// shows only what is in the frozen payload, and adds only the two statements AVAIA already uses (the
// governing statement and the approved disclaimer, both verbatim). It has no hooks and no data access,
// so it renders identically on the server and in the browser.

const label = "text-xs uppercase tracking-wider text-muted";

export default function HandoffView({
  payload,
  sharedByName,
  authorizedAt,
  expiresAt,
  titleTag = "h2",
}: {
  payload: HandoffPayload;
  sharedByName: string;
  authorizedAt?: string | null;
  expiresAt?: string | null;
  titleTag?: "h1" | "h2";
}) {
  const Title = titleTag;
  const facts = FACT_KEYS.map((k) => ({ key: k, fact: payload.facts?.[k] })).filter((f) => !!f.fact);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  return (
    <article className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
      <p className={label}>
        Shared by {sharedByName}
        {authorizedAt ? ` on ${formatLongDate(authorizedAt)}` : ""}
        {expiresAt ? ` · available until ${formatLongDate(expiresAt)}` : ""}
      </p>
      <Title className="mt-2 font-serif text-3xl text-ink">{payload.title}</Title>
      <p className="mt-3 text-sm text-muted">
        Shared with {payload.recipient?.name} ({payload.recipient?.role_label})
      </p>

      <section className="mt-6">
        <p className={label}>Why this is being shared</p>
        <p className="mt-1 whitespace-pre-wrap text-ink">{payload.purpose}</p>
      </section>

      {payload.summary && (
        <section className="mt-6">
          <p className={label}>Summary</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{payload.summary}</p>
        </section>
      )}

      {facts.length > 0 && (
        <section className="mt-6">
          <p className={label}>About this item</p>
          <dl className="mt-2 space-y-2">
            {facts.map(({ key, fact }) => (
              <div key={key}>
                <dt className="text-sm text-muted">{fact!.label}</dt>
                <dd className="text-ink">{fact!.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {entries.length > 0 && (
        <section className="mt-6">
          <p className={label}>In their own words, in the order it happened</p>
          <ol className="mt-3 space-y-4">
            {entries.map((e) => (
              <li key={e.entry_id} className="rounded-lg border border-rule bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-seal">{e.entry_type_label}</p>
                <p className="mt-1 text-xs text-muted">
                  {e.source_label} · {formatLongDate(e.occurred_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap border-l-2 border-seal/50 pl-4 font-serif italic leading-relaxed text-ink">{e.excerpt}</p>
                {e.host_note && (
                  <p className="mt-2 text-sm text-ink">
                    <span className="text-muted">Their note: </span>
                    {e.host_note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {payload.open_questions && (
        <section className="mt-6">
          <p className={label}>Open questions</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{payload.open_questions}</p>
        </section>
      )}

      {payload.requested_follow_up && (
        <section className="mt-6">
          <p className={label}>Requested follow-up</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{payload.requested_follow_up}</p>
        </section>
      )}

      {payload.how_to_reach && (
        <section className="mt-6">
          <p className={label}>How to reach {sharedByName}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{payload.how_to_reach}</p>
        </section>
      )}

      <footer className="mt-8 border-t border-rule pt-5">
        <p className="text-sm text-muted">
          This is a read-only copy{authorizedAt ? ` as of ${formatLongDate(authorizedAt)}` : ""}. It does not change.
        </p>
        <blockquote className="mt-4 border-l-2 border-seal/50 pl-4 font-serif text-sm italic leading-relaxed text-ink">{GOVERNING_STATEMENT}</blockquote>
        <p className="mt-4 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </footer>
    </article>
  );
}
