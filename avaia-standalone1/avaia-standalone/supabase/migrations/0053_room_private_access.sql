-- Shared Room Guide-privacy boundary — Dorian's institutional decision
-- (2026-09-04): private processing inside a Shared Room must be private
-- from every other person, including the facilitating Guide, unless the
-- Host explicitly chooses to share something back.
--
-- The previous build (migration 0051) made private processing an ordinary
-- `conversations` row whose host_id was the *Guide's own* account -- the
-- same pattern every other Guide-facilitated session already uses. That
-- gave participants a real boundary from EACH OTHER, but not from the
-- Guide, because the Guide's own session was the one executing the
-- conversation. Fixing that for real means the private conversation's
-- host_id must belong to the participant's own, separate auth.users
-- identity -- so that every existing self-only RLS policy on
-- conversations/messages/referrals (unchanged, not touched by this
-- migration) naturally excludes the Guide, exactly as it already excludes
-- every Host from every other Host's data today. This is the smallest
-- correct fix: reuse the RLS this product already trusts everywhere else,
-- rather than inventing a new access-control layer.
--
-- This table is the one new piece of infrastructure required: a single-use,
-- time-limited token that hands a participant their own real Supabase
-- session for exactly one private-processing conversation, without a
-- round-trip through the Guide's own account. Same posture as the
-- existing oauth_authorization_codes/oauth_access_tokens tables --
-- service-role only, zero client-facing RLS policies, because the only
-- legitimate caller is server code that has already verified the request
-- through other means (see lib/engine/room.ts and app/api/room-access/*).
create table if not exists public.room_private_access_tokens (
  id                        uuid primary key default gen_random_uuid(),
  room_private_session_id   uuid not null references public.room_private_sessions (id) on delete cascade,
  -- Our own opaque, unguessable token -- not Supabase's own token_hash,
  -- which is stored separately below so it can be handed to the
  -- participant's isolated client for the actual verifyOtp() call without
  -- ever exposing it to the Guide's own session first.
  token                     text not null unique,
  participant_user_id       uuid not null references auth.users (id) on delete cascade,
  supabase_token_hash       text not null,
  created_at                timestamptz not null default now(),
  expires_at                timestamptz not null,
  used_at                   timestamptz
);

create index if not exists room_private_access_tokens_token_idx
  on public.room_private_access_tokens (token);

alter table public.room_private_access_tokens enable row level security;
-- No policies -- service-role only, matching oauth_authorization_codes /
-- oauth_access_tokens above. Every legitimate read/write goes through
-- server code using createAdminClient(), after that code has already
-- verified the caller through the token itself or through the
-- participant's own authenticated identity.
