-- AVAIA Journal, a capability INSIDE the existing Workbook, not a separate
-- product. Governing distinction (Dorian's own framing): "WORKBOOK: what I
-- want to carry with me. JOURNAL: what I want to capture along the way.
-- AVAIA CONVERSATIONS: what I want to explore and understand." A Journal
-- entry is never an AI conversation, is never rewritten, summarized, or
-- interpreted by AVAIA, and is never moved automatically into IAP, CAT,
-- InnerCompass, Shared Rooms, Virtue Signature, or anywhere else -- every
-- one of those connections stays entirely the Host's own later, explicit
-- choice ("the Host brings it to the table").
--
-- Deliberately the smallest table that supports the required experience:
-- no status/soft-delete column (entries are additive and preserved, never
-- edited or removed in this build), no AI-reply column (nothing here ever
-- generates or stores a response), no interpretation/classification
-- columns of any kind.
create table if not exists public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  -- The Host's own words, exactly as written or as faithfully transcribed
  -- by the existing MicButton/transcript-cleanup pipeline (mechanical
  -- punctuation/capitalization/homophone correction only -- see
  -- app/api/transcript-cleanup/route.ts's own system prompt for the exact
  -- boundary). Never rewritten again after save.
  content       text not null,
  -- Purely informational: did the Host write or talk this entry. Changes
  -- nothing about access, storage, or behavior -- recorded only so the
  -- Host's own history can reflect how a thought was actually captured.
  entry_method  text not null check (entry_method in ('write', 'talk')),
  -- Optional, nullable. Set only when the Host opened Journal from a
  -- specific doorway -- one of the small set of existing, already-named
  -- reflection categories (a Virtue Signature layer, an Unsung Heroes
  -- Recognition Cycle stage) offered as an optional prompt, or a specific
  -- Program/Experience the entry relates to. Mirrors the shape already
  -- established by conversations.origin_context (0059) -- a lightweight
  -- provenance tag, never a join anything else depends on, never
  -- authorization-bearing. {source, label} only; deliberately not the
  -- richer chemistry/view-from-above shape, since a journal prompt never
  -- carries a canonical family/definition of its own.
  context       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists journal_entries_host_idx on public.journal_entries (host_id, created_at desc);

alter table public.journal_entries enable row level security;

-- Self-only, full stop. No admin/service-role read policy, no shared_access
-- integration (Dorian: "Do not create new sharing behavior"), no Guide
-- access of any kind, matching or exceeding the privacy posture of every
-- other private Host-content table (conversations/messages). A Youth
-- Host's journal is protected by this exact same rule, with nothing
-- Youth-specific needed -- guardian_consents already establishes that
-- guardian consent never grants content access, and this table has no
-- policy for any guardian/guide/organization role to begin with.
create policy "journal entries are self-only"
  on public.journal_entries for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Widens virtue_signature_entries' existing source_type check (0044) to
-- add 'journal' -- the Host-controlled "carry this into my Virtue
-- Signature" connection reuses addSignatureEntryForHost/
-- /api/virtue-signature/add entirely unchanged; this is the only schema
-- change that connection needs. source_reference holds the journal
-- entry's own id, the same loose-pointer convention every other source
-- type already uses.
alter table public.virtue_signature_entries
  drop constraint if exists virtue_signature_entries_source_type_check;

alter table public.virtue_signature_entries
  add constraint virtue_signature_entries_source_type_check
  check (source_type in (
    'self', 'conversation_referral', 'unsung_heroes', 'observation_offered', 'journal'
  ));
