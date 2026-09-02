-- AVAIA Virtue Signature / Noble Gas Identity -- source-based integration
-- build. Recovers and implements original AVAIA source material (NOT
-- invented here): AVAIA_My_Virtue_Signature_Master_Format_Kit.docx,
-- AVAIA_My_Virtue_Signature_Youth_Experience_Blueprint.docx, VIRTUOUS
-- NOBLE GAS.pptx, and Dorian's own Atom video transcript -- all located
-- and read directly outside this repository, none of it invented.
--
-- Governing model, verbatim from source: "A Virtue Signature is a living
-- recognition record, not a ranked trait list." "Other people can provide
-- evidence, not identity." The transcript confirms the atomic structure:
-- the nucleus is Identity ("that nucleus is the identity of that atom.
-- It doesn't change."); the first ring is Vulnerability + Authenticity,
-- both already-canonical Integrity elements ("those two are protecting
-- our identity... the two elements of integrity that keep us who we
-- are") -- confirmed against lib/virtues.ts before writing this migration:
-- both already exist, family 'integrity', nothing invented or added to
-- the canonical taxonomy. Outer rings are elements the Host already has
-- and can "wake up," never a fixed inventory implying absence of what
-- isn't listed.
--
-- Architecture: reuses guardian_consents' exact dual-subject pattern
-- (0041/0043) -- exactly one of host_id (self-serve) or
-- guide_participant_id (Guide-facilitated) per row, since the same Host-
-- ownership question already had a proven answer. Reuses the canonical
-- family/element validation everywhere (isValidVirtueFamily/
-- isValidVirtueElement, lib/virtues.ts) -- no second Chemistry taxonomy.
-- Does not touch conversations, referrals, or recognitions -- those stay
-- exactly as they are; this is a separate, additive record the Host
-- populates by choice, sourced FROM that existing data but never
-- generated automatically from it.
create table public.virtue_signature_entries (
  id                  uuid primary key default gen_random_uuid(),
  host_id             uuid references auth.users(id) on delete cascade,
  guide_participant_id uuid references public.guide_participants(id) on delete cascade,
  -- The six layers, verbatim from the recovered Master Format Kit's own
  -- Signature Record section -- not renamed, not reorganized.
  layer               text not null check (layer in (
                        'recognize_in_myself',
                        'others_noticed',
                        'qualities_together',
                        'different_expressions',
                        'want_to_practice',
                        'want_to_contribute'
                      )),
  family              text not null,
  element             text,
  -- The Host's own words -- why/how this became visible to them. Never
  -- required; a family+element alone is a complete, valid entry.
  note                text,
  -- Where this entry's evidence came from -- 'self' (the Host added it
  -- directly), 'conversation_referral' (offered from a completed CAT/
  -- InnerCompass referral's own recognized virtues), 'unsung_heroes'
  -- (offered from a recognition the Host gave or received), or
  -- 'observation_offered' (a Guide or another party's observation the
  -- Host chose to accept -- offered, never assigned). source_reference
  -- is a loose pointer (a referral id, a recognition id) for the Host's
  -- own traceability -- never a join other RLS depends on.
  source_type         text not null default 'self' check (source_type in (
                        'self', 'conversation_referral', 'unsung_heroes', 'observation_offered'
                      )),
  source_reference     text,
  -- The Host can later decide something doesn't belong -- "living," not
  -- frozen. Removed rows are kept (status flip, not a delete) so the
  -- Host's own history of what they once recognized and later revised
  -- isn't silently erased -- itself a form of continuity.
  status              text not null default 'active' check (status in ('active', 'removed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint virtue_signature_entries_exactly_one_subject check (
    (host_id is not null and guide_participant_id is null) or
    (host_id is null and guide_participant_id is not null)
  )
);

create index virtue_signature_entries_host_idx on public.virtue_signature_entries (host_id);
create index virtue_signature_entries_participant_idx on public.virtue_signature_entries (guide_participant_id);

alter table public.virtue_signature_entries enable row level security;

-- Host ownership, enforced structurally -- the same posture as every other
-- private AVAIA record. A guardian, school, sponsor, or other Guide has no
-- policy that reaches this table at all; only the Host themselves (self-
-- serve) or the owning Guide (Guide-facilitated, same as their own
-- guide_sessions/guardian_consents access) can read or write it.
create policy "virtue signature own read"
  on public.virtue_signature_entries for select
  using (host_id = auth.uid());

create policy "virtue signature own write"
  on public.virtue_signature_entries for all
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "virtue signature guide read"
  on public.virtue_signature_entries for select
  using (
    guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid())
  );

-- A Guide may offer an observation (source_type = 'observation_offered')
-- for a participant, but per "other people can provide evidence, not
-- identity," a Guide never writes into a status the Host hasn't reviewed
-- -- see lib/virtue-signature.ts's own comment on why offered entries are
-- surfaced for acceptance rather than written directly for a Guide-
-- facilitated participant who cannot yet act for themselves online. This
-- write policy exists for the Guide-run flows (recording their own
-- observations as offered evidence, and the participant's own eventual
-- accept/decline once they have independent access); it does not by
-- itself change what field values are set -- application code, not RLS,
-- is what keeps this Guide-attributed rather than Host-authored.
create policy "virtue signature guide write"
  on public.virtue_signature_entries for all
  using (guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid()))
  with check (guide_participant_id in (select id from public.guide_participants where guide_id = auth.uid()));

create policy "virtue signature admin all"
  on public.virtue_signature_entries for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
