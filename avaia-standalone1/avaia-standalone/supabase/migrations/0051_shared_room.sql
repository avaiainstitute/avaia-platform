-- Shared Room — the production capability for AVAIA to facilitate more than
-- one person in the same experience, per Dorian's explicit product decision
-- (2026-09-04): "THE FULL AVAIA SHARED ROOM IS A REQUIRED PRODUCTION
-- CAPABILITY."
--
-- Governing architecture (do not reinterpret): the Room is not the people --
-- it is what the shared experience has come to be. The Table exists within
-- the Room; Host and Guide are standing seats, Witness is a function not a
-- row. Every participant remains the owner of their own story. The Room may
-- be shared; the stories are not automatically shared.
--
-- Reuse, not reinvention: a Room's PRIVATE processing is not a new engine --
-- it is an ordinary public.conversations row (the exact same IAP-shaped
-- engine, prompts, safety, Youth handling, referrals, and Chemistry every
-- individual Host already gets), only remembered here as having happened
-- inside a Room via room_private_sessions. The six tables below add only
-- the SHARED layer: the Room itself, who is seated at it, the shared
-- conversation, the private<->shared boundary, and the Room's own
-- continuity record. Nothing here creates a second copy of anyone's private
-- Journey content.
--
-- Ownership model matches every existing guide_* table: a Room belongs to
-- the Certified Guide who created it (guide_id = auth.uid()), the same
-- Guide-facilitated pattern already used for guide_participants/
-- guide_sessions throughout the Journey and Unsung Heroes. See this
-- migration's own note below (above room_private_sessions) on the one real
-- limit that pattern places on Guide-blindness to private material --
-- flagged for Dorian, not silently assumed away.

create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  guide_id      uuid not null references auth.users (id) on delete cascade,
  -- Room Identity -- e.g. "Holding Both Sides of the Rope". Nullable: a Room
  -- may not have found its own name yet when created; set or revised later
  -- via updateRoomTitle(), same "reuse or consciously revise" pattern
  -- already used for a Journey's own title in referral-generation.ts.
  title         text,
  program       text not null default 'general' check (program in ('general', 'defying-grief', 'youth')),
  status        text not null default 'active' check (status in ('active', 'complete')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists rooms_guide_idx on public.rooms (guide_id, created_at);

alter table public.rooms enable row level security;
create policy "rooms are guide-owner-only"
  on public.rooms for all
  using (auth.uid() = guide_id) with check (auth.uid() = guide_id);

-- Who is seated at this Room's Table. Every seat here is a Host seat --
-- every participant owns their own story at this Table; there is no
-- "primary" participant. Reuses guide_participants entirely (Youth
-- developmental_band + guardian_consents already live there and apply
-- unchanged to a Youth seated in a Room).
create table if not exists public.room_participants (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.rooms (id) on delete cascade,
  guide_participant_id  uuid not null references public.guide_participants (id) on delete cascade,
  added_at              timestamptz not null default now(),
  -- Soft-removal only -- a participant who leaves a Room keeps their own
  -- prior room_messages/room_shared_items authorship intact; nothing is
  -- deleted, they simply stop being an active seat.
  removed_at            timestamptz,
  unique (room_id, guide_participant_id)
);

create index if not exists room_participants_room_idx on public.room_participants (room_id);

alter table public.room_participants enable row level security;
create policy "room participants via owning guide"
  on public.room_participants for all
  using (exists (select 1 from public.rooms r where r.id = room_participants.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_participants.room_id and r.guide_id = auth.uid()));

-- The shared conversation itself -- what every seated participant and the
-- Guide can see. role='guide' is AVAIA's own Witness-function reply,
-- addressed to the Table as a whole (it may name individuals in its text;
-- it is never itself scoped to one participant). role='participant' rows
-- carry speaker_participant_id so multi-person turns stay individually
-- attributed -- "Person A said X" is never collapsed into "the Room said X".
create table if not exists public.room_messages (
  id                       uuid primary key default gen_random_uuid(),
  room_id                  uuid not null references public.rooms (id) on delete cascade,
  guide_id                 uuid not null references auth.users (id) on delete cascade,
  role                     text not null check (role in ('participant', 'guide')),
  speaker_participant_id   uuid references public.guide_participants (id) on delete set null,
  content                  text not null,
  created_at               timestamptz not null default now(),
  constraint room_messages_speaker_shape check (
    (role = 'participant' and speaker_participant_id is not null)
    or (role = 'guide' and speaker_participant_id is null)
  )
);

create index if not exists room_messages_room_idx on public.room_messages (room_id, created_at);

alter table public.room_messages enable row level security;
create policy "room messages are guide-owner-only"
  on public.room_messages for all
  using (auth.uid() = guide_id) with check (auth.uid() = guide_id);

-- Private processing opened from inside a Room. conversation_id is an
-- ordinary public.conversations row -- the private Journey itself is not
-- reimplemented here, only remembered as Room-linked. return_choice is set
-- once, when the participant leaves private processing: 'keep_private'
-- (nothing crosses back) or 'brought_forward' (see room_shared_items for
-- what, specifically, in the participant's own chosen wording).
--
-- NOTE ON GUIDE VISIBILITY (flagged for Dorian, not assumed away): because
-- every participant today is Guide-facilitated (no participant has their
-- own login), a private conversation's host_id is the Guide's own account,
-- exactly like every other Guide-facilitated conversation already in
-- production. This table gives PARTICIPANTS a real, enforced boundary from
-- EACH OTHER's private material -- that boundary is real and this migration
-- is what makes it real. It does not, and structurally cannot, hide a
-- participant's private conversation from the Guide who is facilitating
-- it, because the Guide's own account is the one executing that
-- conversation. True Guide-blindness would require participants to hold
-- their own accounts -- a separate, larger initiative, not part of this
-- build. See the Final Report's Remaining Decisions section.
create table if not exists public.room_private_sessions (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms (id) on delete cascade,
  participant_id    uuid not null references public.guide_participants (id) on delete cascade,
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  started_at        timestamptz not null default now(),
  returned_at       timestamptz,
  return_choice     text check (return_choice in ('keep_private', 'brought_forward')),
  unique (conversation_id)
);

create index if not exists room_private_sessions_room_idx on public.room_private_sessions (room_id, participant_id);

alter table public.room_private_sessions enable row level security;
create policy "room private sessions via owning guide"
  on public.room_private_sessions for all
  using (exists (select 1 from public.rooms r where r.id = room_private_sessions.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_private_sessions.room_id and r.guide_id = auth.uid()));

-- The ONLY table through which private material becomes visible in a Room.
-- A row here is created exclusively by the owning participant's own
-- explicit choice at the private -> shared boundary (see
-- lib/engine/room.ts's bringToRoom()). content is the participant's OWN
-- chosen wording -- a suggested recognition they accepted as-is, or
-- something they edited/retyped themselves ("say it myself instead" is
-- just this field, hand-authored). Nothing else in this schema ever copies
-- conversation content across the private/shared line.
create table if not exists public.room_shared_items (
  id                          uuid primary key default gen_random_uuid(),
  room_id                     uuid not null references public.rooms (id) on delete cascade,
  participant_id              uuid not null references public.guide_participants (id) on delete cascade,
  source_private_session_id   uuid references public.room_private_sessions (id) on delete set null,
  content                     text not null,
  created_at                  timestamptz not null default now()
);

create index if not exists room_shared_items_room_idx on public.room_shared_items (room_id, created_at);

alter table public.room_shared_items enable row level security;
create policy "room shared items via owning guide"
  on public.room_shared_items for all
  using (exists (select 1 from public.rooms r where r.id = room_shared_items.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_shared_items.room_id and r.guide_id = auth.uid()));

-- The Room's own "What Became Visible" / continuity record -- generated
-- once when the Table chooses to close this Room. Distinct from, and never
-- a container for, any participant's own private Workbook continuity. Its
-- content schema (see lib/engine/room.ts's ROOM_REFERRAL constant) never
-- decides who was right, never manufactures consensus, and preserves
-- disagreement explicitly where it remained.
create table if not exists public.room_referrals (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade unique,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.room_referrals enable row level security;
create policy "room referrals via owning guide"
  on public.room_referrals for all
  using (exists (select 1 from public.rooms r where r.id = room_referrals.room_id and r.guide_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_referrals.room_id and r.guide_id = auth.uid()));
