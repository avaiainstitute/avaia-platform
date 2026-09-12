-- Shared Room Workbook: OURS, distinct from a Host's own private Workbook
-- (MINE, which stays exactly conversations/referrals/virtue-signature,
-- untouched by this migration). A Room's own curated record of what its
-- Table intentionally chose to keep and carry forward, never a copy of
-- the full conversation (room_messages already IS that complete record).
--
-- Two things can land here, deliberately kept in two different tables
-- rather than widening an existing one:
--   1. A message already in the shared thread, explicitly saved by the
--      Guide or a seated participant ("Save to Shared Workbook"), or a
--      freeform note typed directly into the Workbook (shared decisions,
--      agreed next steps -- source='note'). Both live in
--      room_workbook_items, new in this migration.
--   2. Private material a participant explicitly chose to bring forward
--      from their own private conversation. This ALREADY exists --
--      room_shared_items (migration 0051) is exactly this, populated by
--      the already-built, already-tested "Bring this into the Room"
--      flow (lib/engine/room.ts's returnToRoomAsParticipant). Untouched
--      here; the Shared Workbook reads it, it doesn't duplicate it.
--
-- Same ownership/RLS posture as every other Room table: guide-owner-only
-- via RLS (auth.uid() = room.guide_id); a seated participant's access
-- goes through the admin client + resolveSeatedParticipant, the same
-- pattern already governing every participant-facing function in
-- lib/engine/room.ts. Room authorization, not account role elsewhere in
-- AVAIA, is what decides who can see this.
create table if not exists public.room_workbook_items (
  id                       uuid primary key default gen_random_uuid(),
  room_id                  uuid not null references public.rooms (id) on delete cascade,
  content                  text not null,
  -- Whose words this is, when it's appropriate to say so (a saved message
  -- from a named participant); null for a Room-level note with no single
  -- speaker, or a saved AVAIA/Witness turn. Snapshotted as text, not a
  -- live FK to guide_participants, so attribution survives a participant
  -- later being removed from the Room -- the Workbook is meant to
  -- outlive any one seat.
  speaker_name             text,
  source                   text not null check (source in ('room_message', 'note')),
  -- Present only when source='room_message', a provenance pointer back to
  -- the exact turn this was saved from. on delete set null: room_messages
  -- rows are never deleted in practice, but a saved item must never
  -- disappear even if that ever changed.
  source_room_message_id   uuid references public.room_messages (id) on delete set null,
  -- Who performed the SAVE action (curation), distinct from speaker_name
  -- (authorship) -- a Guide can save a participant's own words, and a
  -- participant can save the Witness's reply. Null added_by_participant_id
  -- means the Guide (a human, not AVAIA) did the saving.
  added_by_participant_id  uuid references public.guide_participants (id) on delete set null,
  added_by_name            text not null,
  created_at               timestamptz not null default now()
);

create index if not exists room_workbook_items_room_idx on public.room_workbook_items (room_id, created_at);

alter table public.room_workbook_items enable row level security;
create policy "room workbook items via owning guide"
  on public.room_workbook_items
  for all
  using (exists (select 1 from public.rooms r where r.id = room_workbook_items.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_workbook_items.room_id and r.guide_id = auth.uid()));
