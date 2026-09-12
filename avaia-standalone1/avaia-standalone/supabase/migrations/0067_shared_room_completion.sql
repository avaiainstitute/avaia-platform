-- Shared Room completion. Additive only, per the Shared Room Capability
-- Audit: nothing here changes the private step-out's existing RLS/identity
-- behavior (room_private_sessions, room_private_access_tokens, the
-- conversations/journeys/messages RLS a participant's private conversation
-- already relies on), which the audit confirmed already works correctly.
--
-- Adds exactly what the audit found missing:
--   1. A durable, reusable, revocable Room-join invitation (room_invitations),
--      separate from the existing single-use 30-minute private-processing
--      token (room_private_access_tokens), which stays exactly as-is.
--   2. A simple raise-hand / floor system (room_turn_requests +
--      rooms.floor_participant_id), deliberately not a locking mechanism,
--      see lib/engine/room.ts for why.
--   3. last_seen_at on room_participants, for "while you were away."
--   4. status widened to include 'paused' and 'archived', all transitions
--      reversible, so 'complete' never destroys the ability to revisit a
--      Room (its history was already preserved; this closes the last gap,
--      that only the Guide could ever read it again).

-- ---------------------------------------------------------------------
-- 1. Room invitations (join the Room itself, distinct from private access)
-- ---------------------------------------------------------------------
create table if not exists public.room_invitations (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.guide_participants(id) on delete cascade,
  token          text not null unique,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz,
  unique (room_id, participant_id)
);

alter table public.room_invitations enable row level security;

create policy "room invitations via owning guide"
  on public.room_invitations
  for all
  using (exists (select 1 from public.rooms r where r.id = room_invitations.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_invitations.room_id and r.guide_id = auth.uid()));

-- No participant-facing RLS policy, same posture as room_private_access_tokens:
-- RLS enabled with zero policies means deny-all except the service-role
-- (admin) client, which is exactly how the join-consumption route reads it
-- (the token itself is the credential, there is no signed-in user yet).

-- ---------------------------------------------------------------------
-- 2. Floor / raise-hand (simple, visible, not a hard lock, see room.ts)
-- ---------------------------------------------------------------------
alter table public.rooms
  add column if not exists floor_participant_id uuid references public.guide_participants(id) on delete set null;

create table if not exists public.room_turn_requests (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null references public.guide_participants(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'recognized', 'withdrawn')),
  requested_at   timestamptz not null default now(),
  resolved_at    timestamptz
);

alter table public.room_turn_requests enable row level security;

create policy "room turn requests via owning guide"
  on public.room_turn_requests
  for all
  using (exists (select 1 from public.rooms r where r.id = room_turn_requests.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_turn_requests.room_id and r.guide_id = auth.uid()));

-- Same deny-all-except-admin posture as room_invitations; participants
-- raise/withdraw hands and the Guide recognizes them through dedicated
-- server routes using the admin client with explicit ownership checks,
-- the same established pattern as returnToRoomAsParticipant.

-- ---------------------------------------------------------------------
-- 3. Last-seen, for "while you were away"
-- ---------------------------------------------------------------------
alter table public.room_participants
  add column if not exists last_seen_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. Room lifecycle: paused / archived, all reversible
-- ---------------------------------------------------------------------
alter table public.rooms
  drop constraint if exists rooms_status_check;
alter table public.rooms
  add constraint rooms_status_check
    check (status in ('active', 'paused', 'complete', 'archived'));
