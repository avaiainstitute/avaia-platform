-- 0117_kept_items.sql
--
-- Move 7: "Keep this". A Host can intentionally carry something from an AVAIA
-- experience into their own continuing record, without a Guide ever deciding what
-- belongs there and without anything private being kept automatically.
--
--   kept_items         the Host-owned continuity record. Only the Host (or the
--                      Host's own verified action on the server) creates a row.
--                      No Guide, admin or operational policy reaches it at all.
--   guide_item_offers  a Guide's offer of something from a Guide-run session back
--                      to the participant. It holds a POINTER and a label only, never
--                      the text. The Host sees metadata, then confirms the session is
--                      theirs, then sees the item, then chooses Keep or Decline. A
--                      Guide can see an offer only while it is still waiting; what the
--                      Host decides is never visible to the Guide.
--
-- Also: a Guide can no longer write into a participant's Virtue Signature. That
-- was a competing path (a Guide placing a participant's material in a record the
-- Guide controls). Offering is the only path now. Existing rows (none) and the
-- Guide's read of them are untouched. Safe to run more than once.

-- kept_items ------------------------------------------------------------------
create table if not exists public.kept_items (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null check (kind in ('host_voice', 'recognition')),
  label             text not null,
  -- The kept text, verbatim, copied at the moment the Host chose Keep so it
  -- survives anything that later happens to the source or to a Guide's account.
  content           text not null,
  source_type       text not null check (source_type in ('journey_conversation', 'unsung_heroes_recognition', 'guide_offer')),
  -- A conversation or recognition id: a loose pointer for traceability, never a join
  -- any other rule depends on.
  source_reference  text not null,
  -- One identity per kept thing, so keeping it twice is the same item.
  source_key        text not null,
  -- Provenance only. A Guide who offered it is recorded as where it came from;
  -- the Guide is never the owner.
  from_guide_id     uuid references auth.users (id) on delete set null,
  from_guide_name   text,
  from_session_date timestamptz,
  -- The Host can take it back out; the row is kept so the Host's own history is not erased.
  status            text not null default 'active' check (status in ('active', 'removed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (host_id, source_key)
);

create index if not exists kept_items_host_idx on public.kept_items (host_id, created_at desc);

alter table public.kept_items enable row level security;

do $$ begin
  create policy "kept items own read" on public.kept_items for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- A Host may insert their own row directly only for their own Journey or recognition.
-- Anything that claims to have come through a Guide is written only by the server after it
-- has verified the Host's confirmation, so that provenance cannot be forged from a browser.
do $$ begin
  create policy "kept items own insert" on public.kept_items for insert
    with check (host_id = auth.uid() and source_type <> 'guide_offer' and from_guide_id is null and from_guide_name is null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "kept items own update" on public.kept_items for update
    using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "kept items own delete" on public.kept_items for delete using (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- What was kept is never rewritten. The Host can only take an item out or put it back.
create or replace function public.kept_items_protect_content() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.host_id is distinct from old.host_id
     or new.kind is distinct from old.kind
     or new.label is distinct from old.label
     or new.content is distinct from old.content
     or new.source_type is distinct from old.source_type
     or new.source_reference is distinct from old.source_reference
     or new.source_key is distinct from old.source_key
     or new.from_guide_id is distinct from old.from_guide_id
     or new.from_guide_name is distinct from old.from_guide_name
     or new.from_session_date is distinct from old.from_session_date then
    raise exception 'A kept item cannot be rewritten; it can only be removed or restored.';
  end if;
  return new;
end $$;

drop trigger if exists kept_items_protect_content on public.kept_items;
create trigger kept_items_protect_content before update on public.kept_items
  for each row execute function public.kept_items_protect_content();

comment on table public.kept_items is
  'The Host-owned continuity record (Keep this). Only the Host creates a row. No Guide, admin or operational policy by design; nothing here is ever kept automatically.';

-- guide_item_offers -----------------------------------------------------------
create table if not exists public.guide_item_offers (
  id                 uuid primary key default gen_random_uuid(),
  guide_id           uuid not null references auth.users (id) on delete cascade,
  participant_id     uuid not null references public.guide_participants (id) on delete cascade,
  session_id         uuid not null references public.guide_sessions (id) on delete cascade,
  source_type        text not null check (source_type in ('referral_field', 'recognition')),
  field              text,
  item_index         integer,
  recognition_id     uuid,
  -- Metadata only, e.g. "Anchor statement". Never the text.
  label              text not null,
  source_key         text not null unique,
  state              text not null default 'offered' check (state in ('offered', 'confirmed', 'kept', 'declined')),
  host_confirmed_by  uuid references auth.users (id) on delete set null,
  host_confirmed_at  timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  constraint guide_item_offers_pointer check (
    (source_type = 'referral_field' and field is not null and item_index is not null and recognition_id is null)
    or (source_type = 'recognition' and recognition_id is not null and field is null and item_index is null)
  )
);

create index if not exists guide_item_offers_participant_idx on public.guide_item_offers (participant_id, state);
create index if not exists guide_item_offers_guide_idx on public.guide_item_offers (guide_id, state);

alter table public.guide_item_offers enable row level security;

-- The Guide sees an offer only while it is waiting. Once the Host has kept or declined it,
-- it is out of the Guide's sight: the Guide never learns what the Host chose.
do $$ begin
  create policy "guide item offers guide read" on public.guide_item_offers for select
    using (guide_id = auth.uid() and state in ('offered', 'confirmed'));
exception when duplicate_object then null; end $$;

-- A Guide can only create an 'offered' row, for their own participant and their own session
-- with that participant. They cannot create a confirmed, kept or declined one, and there is
-- no update policy: only the Host's verified action (on the server) moves an offer on.
do $$ begin
  create policy "guide item offers guide insert" on public.guide_item_offers for insert
    with check (
      guide_id = auth.uid()
      and state = 'offered'
      and host_confirmed_by is null
      and exists (select 1 from public.guide_participants p where p.id = participant_id and p.guide_id = auth.uid())
      and exists (select 1 from public.guide_sessions s where s.id = session_id and s.guide_id = auth.uid() and s.participant_id = participant_id)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "guide item offers guide withdraw" on public.guide_item_offers for delete
    using (guide_id = auth.uid() and state in ('offered', 'confirmed'));
exception when duplicate_object then null; end $$;

comment on table public.guide_item_offers is
  'A Guide''s offer of an item from a Guide-run session back to the participant. A pointer and a label only, never the text. The Host confirms, sees, then keeps or declines; the Guide never learns the decision.';

-- A Guide can no longer write into a participant's Virtue Signature --------------
drop policy if exists "virtue signature guide write" on public.virtue_signature_entries;

-- Verification (read-only).
select
  (select relrowsecurity from pg_class where relname = 'kept_items') as kept_rls,
  (select relrowsecurity from pg_class where relname = 'guide_item_offers') as offers_rls,
  (select count(*) from pg_policies where tablename = 'kept_items') as kept_policies,
  (select count(*) from pg_policies where tablename = 'kept_items' and (policyname ~* 'guide|admin' or qual ~* 'admin')) as kept_guide_or_admin_policies_must_be_zero,
  (select count(*) from pg_policies where tablename = 'guide_item_offers') as offer_policies,
  (select count(*) from pg_policies where tablename = 'virtue_signature_entries' and policyname = 'virtue signature guide write') as signature_guide_write_must_be_zero;
