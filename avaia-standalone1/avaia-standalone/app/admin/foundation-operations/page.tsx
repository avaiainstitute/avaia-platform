import { getPinkFoundationOperationsSummary, getDonorSponsorRecordsForDisplay } from "@/lib/ops/pink-foundation-operations";

export const metadata = { title: "Foundation Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Admin-facing Pink Shoelace Foundation Operations + Legacy Control view --
 *  extends /admin alongside Certification, Guide, Host/Participant, and
 *  Organization/Event Operations. Exceptions-first, same posture as every
 *  other Operations admin page: healthy/closed items are summarized as
 *  counts, never listed individually.
 *
 *  GOVERNING ROLE, visible here structurally: nothing on this page can
 *  approve a charitable expenditure, sign for Legacy, or mark something
 *  Legacy-approved. "Approved" state is only ever read back from a
 *  human-recorded field -- there is no button or action here that sets
 *  it. This page shows what is ready to route to Legacy, what Legacy is
 *  already reviewing, and what has come back needing a human decision --
 *  nothing more. */
export default async function AdminFoundationOperationsPage() {
  const { summary, legacyReviewItems, sponsoredAccess, campaignItems, commercialCoVentures, volunteers, partnerships } =
    await getPinkFoundationOperationsSummary();
  const donorSponsorRecords = await getDonorSponsorRecordsForDisplay();

  const legacyWaitingOrOverdue = legacyReviewItems.filter((i) => i.exception?.category === "WAITING" || i.exception?.category === "STALE");
  const legacyChangesRequired = legacyReviewItems.filter((i) => i.state === "changes_required");
  const legacyHealthyCount = legacyReviewItems.length - legacyWaitingOrOverdue.length - legacyChangesRequired.length;

  const sponsoredAccessExceptions = sponsoredAccess.filter((r) => r.exception !== null);
  const sponsoredAccessHealthyCount = sponsoredAccess.length - sponsoredAccessExceptions.length;

  const campaignExceptions = campaignItems.filter((c) => c.exception !== null);
  const campaignHealthyCount = campaignItems.length - campaignExceptions.length;

  const coVenturesNeedingReview = commercialCoVentures.filter((c) => c.reviewRequired);
  const coVenturesClearedCount = commercialCoVentures.length - coVenturesNeedingReview.length;

  const volunteerExceptions = volunteers.filter((v) => v.exception !== null);
  const volunteerHealthyCount = volunteers.length - volunteerExceptions.length;

  const partnershipExceptions = partnerships.filter((p) => p.exception !== null);
  const partnershipHealthyCount = partnerships.length - partnershipExceptions.length;

  const nothingAtAll =
    legacyReviewItems.length === 0 &&
    sponsoredAccess.length === 0 &&
    campaignItems.length === 0 &&
    commercialCoVentures.length === 0 &&
    volunteers.length === 0 &&
    partnerships.length === 0;

  return (
    <div>
      <p className="label mb-3">Foundation Operations</p>
      <h1 className="font-serif text-4xl text-ink">The Pink Shoelace Foundation</h1>
      <p className="mt-4 text-lg text-muted">
        Legacy Review Queue, Sponsored Access, partnerships, campaign review, commercial
        co-venture triggers, and Community Connection volunteers. This agent prepares, collects,
        organizes, tracks, reminds, and routes -- it never approves a charitable expenditure,
        signs for Legacy, or declares something Legacy-approved on its own.
      </p>

      {nothingAtAll && (
        <p className="mt-12 text-muted">
          No Foundation operational records on file yet. The tracking/routing schema is in place
          (see the governing audit) and the cron reminder job is wired and running, but every row
          in this build&rsquo;s tables is created deliberately -- there is no automatic intake path
          yet, so nothing has been entered.
        </p>
      )}

      {!nothingAtAll && (
        <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
          <p className="label mb-2 text-muted">At a glance</p>
          <p className="text-sm text-ink">
            {legacyHealthyCount} Legacy Review item(s) approved or closed &middot; {sponsoredAccessHealthyCount} Sponsored
            Access request(s) paid or not yet started &middot; {campaignHealthyCount} campaign item(s) healthy &middot;{" "}
            {coVenturesClearedCount} commercial co-venture(s) cleared by Legacy &middot; {volunteerHealthyCount} volunteer(s)
            with no safety review flagged &middot; {partnershipHealthyCount} partnership(s) with nothing due.
          </p>
        </section>
      )}

      {legacyChangesRequired.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Legacy Requested Changes ({legacyChangesRequired.length})</p>
          <div className="mt-3 space-y-3">
            {legacyChangesRequired.map((item) => (
              <div key={item.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-lg text-ink">{item.description}</p>
                <p className="mt-1 text-sm text-muted">{item.itemType} &middot; owner: {item.foundationOwner ?? "unassigned"}</p>
                {item.changesRequiredNotes && <p className="mt-2 text-sm text-ink">{item.changesRequiredNotes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {legacyWaitingOrOverdue.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Legacy Review Queue -- Waiting / Overdue ({legacyWaitingOrOverdue.length})</p>
          <div className="mt-3 space-y-3">
            {legacyWaitingOrOverdue.map((item) => (
              <div key={item.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{item.description}</p>
                  <span className="label text-muted">{item.exception?.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{item.itemType} &middot; state: {item.state}</p>
                <p className="mt-2 text-sm text-ink">{item.exception?.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {sponsoredAccessExceptions.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Sponsored Access ({sponsoredAccessExceptions.length})</p>
          <div className="mt-3 space-y-3">
            {sponsoredAccessExceptions.map((r) => (
              <div key={r.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{r.providerOrganization}</p>
                  <span className="label text-muted">{r.exception?.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{r.charitablePurpose}</p>
                <p className="mt-2 text-sm text-ink">{r.exception?.reason}</p>
                <p className="mt-1 text-xs text-muted">Payment status: {r.paymentStatus} (Legacy pays the provider -- this system never pays directly)</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {partnershipExceptions.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Partnership Follow-ups ({partnershipExceptions.length})</p>
          <div className="mt-3 space-y-3">
            {partnershipExceptions.map((p) => (
              <div key={p.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{p.organizationName}</p>
                  <span className="label text-muted">{p.exception?.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted">stage: {p.stage}</p>
                <p className="mt-2 text-sm text-ink">{p.exception?.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {campaignExceptions.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Campaign Review ({campaignExceptions.length})</p>
          <div className="mt-3 space-y-3">
            {campaignExceptions.map((c) => (
              <div key={c.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{c.title}</p>
                  <span className="label text-muted">{c.exception?.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted">state: {c.state}</p>
                <p className="mt-2 text-sm text-ink">{c.exception?.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {coVenturesNeedingReview.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Commercial Co-Venture Reviews ({coVenturesNeedingReview.length})</p>
          <div className="mt-3 space-y-3">
            {coVenturesNeedingReview.map((c) => (
              <div key={c.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{c.proposedPartner}</p>
                  <span className="label text-muted">{c.label}</span>
                </div>
                <p className="mt-2 text-sm text-ink">
                  Any arrangement advertising that a portion of sales benefits the Foundation requires Legacy review before it proceeds.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {volunteerExceptions.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Volunteer Safety Reviews ({volunteerExceptions.length})</p>
          <div className="mt-3 space-y-3">
            {volunteerExceptions.map((v) => (
              <div key={v.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{v.name}</p>
                  <span className="label text-muted">{v.exception?.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted">onboarding: {v.onboardingStatus}</p>
                <p className="mt-2 text-sm text-ink">{v.exception?.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {donorSponsorRecords.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Donor / Sponsor Interest -- visibility only ({donorSponsorRecords.length})</p>
          <p className="mt-1 text-sm text-muted">
            No donation processor is connected (audited: Give Payments is not integrated; the
            Foundation&rsquo;s own site still says donations are coming soon). These are expressions
            of interest only, logged for Legacy/Dorian to follow up on manually.
          </p>
          <div className="mt-3 space-y-2">
            {donorSponsorRecords.map((d) => (
              <div key={d.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 backdrop-blur-sm">
                <p className="text-sm text-ink">
                  {d.donorName} {d.donorType ? `(${d.donorType})` : ""} &middot; {d.status}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
