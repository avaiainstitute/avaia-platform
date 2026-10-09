-- 0121_coordination_entries.sql
--
-- Coordination layer, Phase 2: the Decision & Capacity Continuity Record (Decision 0008).
--
--   "AVAIA may create and preserve a longitudinal record of a Host's expressed understanding,
--    reasoning, choices, questions, and participation in consequential decisions. AVAIA does not
--    independently determine or declare legal capacity or incapacity."
--
-- coordination_entries is the append-only record attached to a Host's own decision
-- (coordination_items.kind = 'decision'). It documents participation over time. It holds no
-- score, no conclusion, no interpretation and no AI-generated text of any kind; every entry type
-- and every "position" value is chosen by the Host.
--
-- Founder decision (history): WITHDRAW, NEVER ERASE. A Host may withdraw an entry from active use
-- and restore it later. The entry itself is never erased or rewritten, there is no erased_at and
-- no delete policy. withdrawn_at is the only thing that can ever change.
--
-- Integrity, enforced by the database and not only by the application:
--   * A Host's browser can directly insert only a Host note. Every entry that copies a source (a
--     message, a referral field, a Room message) is written by the server after it re-reads the
--     source, and the database re-verifies it again here: the excerpt must really come from that
--     source, it must be the Host's OWN words, and the source's own timestamp is what is stored.
--   * An entry can only be added to the Host's own decision, and only for an adult account.
--   * Source pointers are plain ids with no foreign key, so the reference to the original source
--     is preserved exactly as it was even if the source record is later removed.
--   * Nothing here changes coordination_items, conversations, messages, referrals or any Room table.
--
-- Safe to run more than once.

create table if not exists public.coordination_entries (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references auth.users (id) on delete cascade,
  item_id         uuid not null,

  -- Chosen by the Host. Never inferred.
  entry_type      text not null check (entry_type in (
                    'wanted',
                    'understood',
                    'reasoning',
                    'question',
                    'alternative',
                    'consequence',
                    'undecided',
                    'more_time',
                    'position_consistent',
                    'position_changed',
                    'communicate_to_others'
                  )),
  -- Private versus Shared Room is represented here: the first two are private; room_message is a
  -- Shared Room. A host_note is the Host's own writing, set down when it was written.
  source_kind     text not null check (source_kind in ('conversation_message', 'referral_field', 'room_message', 'host_note')),
  -- The SOURCE's own timestamp (set by the database from the source). For a host_note, the moment
  -- it was written. created_at below is separately when it was added to the record.
  occurred_at     timestamptz not null,
  -- Verbatim, copied at the moment the Host chose it. For a referral field it is the referral's
  -- own text and is labelled "From your referral" wherever it is shown.
  excerpt         text not null check (char_length(btrim(excerpt)) between 1 and 20000),
  -- The Host's own words about this entry. For position_changed, the Host's own explanation.
  host_note       text check (host_note is null or char_length(host_note) <= 2000),

  conversation_id uuid,
  message_id      uuid,
  referral_id     uuid,
  referral_field  text check (referral_field is null or referral_field in (
                    'anchorStatements', 'reflectionsThatEmerged', 'questionsWorthCarrying', 'decisionsMade', 'commitmentsChosen'
                  )),
  referral_index  integer check (referral_index is null or referral_index >= 0),
  room_id         uuid,
  room_message_id uuid,
  room_label      text check (room_label is null or char_length(room_label) <= 200),

  -- Who was present, derived from records and never typed: "You and AVAIA" for a private
  -- conversation, a snapshot of the actual Room participants for a Shared Room.
  present_note    text check (present_note is null or char_length(present_note) <= 1000),
  -- One identity per copied source, so the same source cannot be added twice for the same entry type.
  source_key      text,

  created_at      timestamptz not null default now(),
  withdrawn_at    timestamptz,

  constraint coordination_entries_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id),
  constraint coordination_entries_source_shape check (
    (source_kind = 'host_note'
       and conversation_id is null and message_id is null
       and referral_id is null and referral_field is null and referral_index is null
       and room_id is null and room_message_id is null and room_label is null)
    or (source_kind = 'conversation_message'
       and conversation_id is not null and message_id is not null
       and referral_id is null and referral_field is null and referral_index is null
       and room_id is null and room_message_id is null and room_label is null)
    or (source_kind = 'referral_field'
       and referral_id is not null and referral_field is not null and referral_index is not null
       and conversation_id is null and message_id is null
       and room_id is null and room_message_id is null and room_label is null)
    or (source_kind = 'room_message'
       and room_id is not null and room_message_id is not null and room_label is not null
       and conversation_id is null and message_id is null
       and referral_id is null and referral_field is null and referral_index is null)
  )
);

create index if not exists coordination_entries_item_time_idx
  on public.coordination_entries (item_id, occurred_at);
create unique index if not exists coordination_entries_source_unique
  on public.coordination_entries (item_id, entry_type, source_key) where source_key is not null;

alter table public.coordination_entries enable row level security;

-- Host read: the Host's own entries, and no one else's.
do $$ begin
  create policy "coordination entries own read" on public.coordination_entries
    for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Host insert: ONLY a Host note, by an adult account. Source-backed entries are written by the
-- server after it re-reads the source (and the trigger below verifies them again).
do $$ begin
  create policy "coordination entries own insert" on public.coordination_entries
    for insert with check (
      host_id = auth.uid()
      and source_kind = 'host_note'
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.developmental_band is not null)
    );
exception when duplicate_object then null; end $$;

-- Host update: own rows. The guard trigger below limits the change to withdrawn_at.
do $$ begin
  create policy "coordination entries own update" on public.coordination_entries
    for update using (host_id = auth.uid())
    with check (
      host_id = auth.uid()
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.developmental_band is not null)
    );
exception when duplicate_object then null; end $$;

-- Deliberately NO delete policy. Withdraw, never erase.

-- Insert check: the parent is the Host's own decision, the account is an adult, and a copied source
-- is verified against the real source record. The database writes the source's own timestamp.
create or replace function public.coordination_entries_check_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  parent_kind text;
  src record;
  field_text text;
begin
  select kind into parent_kind from public.coordination_items where id = new.item_id and host_id = new.host_id;
  if parent_kind is distinct from 'decision' then
    raise exception 'An entry can only be added to one of the Host''s own decisions.';
  end if;
  if exists (select 1 from public.profiles p where p.id = new.host_id and p.developmental_band is not null) then
    raise exception 'The continuity record is available to adult accounts in this release.';
  end if;

  new.withdrawn_at := null;

  if new.source_kind = 'host_note' then
    new.occurred_at := now();
    new.created_at := now();
    new.source_key := null;

  elsif new.source_kind = 'conversation_message' then
    select m.content, m.role, m.created_at, m.conversation_id, c.host_id
      into src
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.id = new.message_id;
    if not found or src.conversation_id is distinct from new.conversation_id or src.host_id is distinct from new.host_id or src.role is distinct from 'host' then
      raise exception 'A conversation entry must come from one of the Host''s own messages.';
    end if;
    if exists (select 1 from public.guide_sessions gs where gs.conversation_id = new.conversation_id) then
      raise exception 'A conversation a Guide facilitated for someone else cannot be added.';
    end if;
    if position(new.excerpt in src.content) = 0 then
      raise exception 'The excerpt is not from that message.';
    end if;
    new.occurred_at := src.created_at;
    new.source_key := 'message:' || new.message_id::text;

  elsif new.source_kind = 'referral_field' then
    select r.content, r.host_id, r.created_at, r.conversation_id
      into src
      from public.referrals r
     where r.id = new.referral_id;
    if not found or src.host_id is distinct from new.host_id then
      raise exception 'A referral entry must come from the Host''s own referral.';
    end if;
    if src.conversation_id is not null and exists (select 1 from public.guide_sessions gs where gs.conversation_id = src.conversation_id) then
      raise exception 'A referral from a conversation a Guide facilitated for someone else cannot be added.';
    end if;
    field_text := btrim((src.content::jsonb -> new.referral_field) ->> new.referral_index);
    if field_text is null or field_text <> btrim(new.excerpt) then
      raise exception 'The excerpt is not that referral field.';
    end if;
    new.occurred_at := src.created_at;
    new.source_key := 'referral:' || new.referral_id::text || ':' || new.referral_field || ':' || new.referral_index::text;

  elsif new.source_kind = 'room_message' then
    select rm.content, rm.role, rm.created_at, rm.room_id, rm.speaker_participant_id
      into src
      from public.room_messages rm
     where rm.id = new.room_message_id;
    if not found
       or src.room_id is distinct from new.room_id
       or src.role is distinct from 'participant'
       or not exists (
            select 1 from public.guide_participants gp
             where gp.id = src.speaker_participant_id and gp.linked_host_id = new.host_id
          ) then
      raise exception 'A Shared Room entry must be the Host''s own words, in a Room they are seated in.';
    end if;
    if position(new.excerpt in src.content) = 0 then
      raise exception 'The excerpt is not from that message.';
    end if;
    new.occurred_at := src.created_at;
    new.source_key := 'room:' || new.room_message_id::text;
  end if;

  return new;
end $$;

drop trigger if exists coordination_entries_check_insert on public.coordination_entries;
create trigger coordination_entries_check_insert before insert on public.coordination_entries
  for each row execute function public.coordination_entries_check_insert();

-- Guard: an entry is never rewritten. The only thing that can change is withdrawn_at, set by the
-- database (withdraw stamps now; a second withdraw never re-stamps; restore clears it).
create or replace function public.coordination_entries_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.host_id is distinct from old.host_id
     or new.item_id is distinct from old.item_id
     or new.entry_type is distinct from old.entry_type
     or new.source_kind is distinct from old.source_kind
     or new.occurred_at is distinct from old.occurred_at
     or new.excerpt is distinct from old.excerpt
     or new.host_note is distinct from old.host_note
     or new.conversation_id is distinct from old.conversation_id
     or new.message_id is distinct from old.message_id
     or new.referral_id is distinct from old.referral_id
     or new.referral_field is distinct from old.referral_field
     or new.referral_index is distinct from old.referral_index
     or new.room_id is distinct from old.room_id
     or new.room_message_id is distinct from old.room_message_id
     or new.room_label is distinct from old.room_label
     or new.present_note is distinct from old.present_note
     or new.source_key is distinct from old.source_key
     or new.created_at is distinct from old.created_at then
    raise exception 'A continuity entry cannot be rewritten; it can only be withdrawn or restored.';
  end if;

  if old.withdrawn_at is null and new.withdrawn_at is not null then
    new.withdrawn_at := now();
  elsif old.withdrawn_at is not null and new.withdrawn_at is not null then
    new.withdrawn_at := old.withdrawn_at;
  end if;

  return new;
end $$;

drop trigger if exists coordination_entries_guard on public.coordination_entries;
create trigger coordination_entries_guard before update on public.coordination_entries
  for each row execute function public.coordination_entries_guard();

comment on table public.coordination_entries is
  'The Decision & Capacity Continuity Record (Decision 0008): a Host-owned, append-only record of what the Host expressed in a consequential decision. Documents participation; never a conclusion about capacity. No score, no AI-generated text. Withdraw, never erase: no delete policy, no erased column. A Host browser can insert only a host_note; copied sources are written by the server and re-verified here.';
comment on column public.coordination_entries.occurred_at is
  'The source''s own timestamp, set by the database from the source (a host_note: when it was written). created_at is separately when the entry was added to the record.';
comment on column public.coordination_entries.entry_type is
  'Chosen by the Host. position_consistent and position_changed are Host-selected; AVAIA never compares entries or decides a position changed.';
comment on column public.coordination_entries.source_kind is
  'conversation_message and referral_field are private; room_message is a Shared Room (the Host''s own words only); host_note is the Host''s own writing. A referral_field is labelled "From your referral" and is never presented as a verbatim conversation message.';
comment on column public.coordination_entries.withdrawn_at is
  'Set when the Host withdraws the entry from active use; cleared if they restore it. The entry itself is never erased or rewritten.';
