-- Consent-based Workbook sharing — run once against the live database
-- (Supabase SQL editor), after 0001_membership_status.sql. Safe to re-run:
-- every clause is skipped if it already exists.

-- referrals.conversation_id — the existing referrals table has no link back
-- to the conversation it came from (only host_id + from_stage/to_stage
-- names), which is too weak to scope a single-conversation share correctly:
-- a Host may repeat IAP/CAT/InnerCompass across multiple journeys, so stage
-- name alone can't identify "the referral from THIS conversation." This
-- column closes that gap; existing rows stay null (pre-dates this feature),
-- and app/api/referral/route.ts now populates it going forward.
alter table public.referrals
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

create index if not exists referrals_conversation_idx on public.referrals (conversation_id);

-- ---------------------------------------------------------------------------
-- shared_access — an active grant. Sharing is read-only: it extends SELECT
-- access on conversations/messages/referrals, never insert/update/delete —
-- only the owning Host can ever write their own record.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_access (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  shared_with_id   uuid not null references auth.users (id) on delete cascade,
  scope            text not null check (scope in ('conversation', 'workbook')),
  conversation_id  uuid references public.conversations (id) on delete cascade,
  granted_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  constraint shared_access_scope_shape check (
    (scope = 'conversation' and conversation_id is not null)
    or (scope = 'workbook' and conversation_id is null)
  )
);

create index if not exists shared_access_owner_idx on public.shared_access (owner_id);
create index if not exists shared_access_shared_with_idx on public.shared_access (shared_with_id);

alter table public.shared_access enable row level security;

-- The owner manages (creates, revokes) their own grants.
create policy "shared_access owner manage"
  on public.shared_access for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- The recipient can see grants made TO them (drives "Shared with me"), but
-- cannot create, modify, or revoke anything themselves.
create policy "shared_access recipient read"
  on public.shared_access for select
  using (auth.uid() = shared_with_id);

-- ---------------------------------------------------------------------------
-- shared_access_invites — a pending share to an email with no AVAIA account
-- yet. handle_new_user() (below) converts matching pending invites into real
-- shared_access rows the moment that email signs up.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_access_invites (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  invited_email    text not null,
  scope            text not null check (scope in ('conversation', 'workbook')),
  conversation_id  uuid references public.conversations (id) on delete cascade,
  invited_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  constraint shared_access_invites_scope_shape check (
    (scope = 'conversation' and conversation_id is not null)
    or (scope = 'workbook' and conversation_id is null)
  )
);

create index if not exists shared_access_invites_owner_idx on public.shared_access_invites (owner_id);
create index if not exists shared_access_invites_email_idx on public.shared_access_invites (invited_email);

alter table public.shared_access_invites enable row level security;

-- Self-only for the owner; the invited person isn't an AVAIA account yet, so
-- there's no one else to grant a policy to here. handle_new_user() runs
-- security definer, so it bypasses RLS entirely when accepting an invite.
create policy "shared_access_invites owner manage"
  on public.shared_access_invites for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Extend conversations / messages / referrals RLS: the existing "self-only"
-- policies are untouched (still the only way to INSERT/UPDATE/DELETE); these
-- ADD read-only access for anyone holding a live (unrevoked) shared_access
-- grant that covers the row.
-- ---------------------------------------------------------------------------
create policy "conversations shared read"
  on public.conversations for select
  using (
    exists (
      select 1 from public.shared_access sa
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = conversations.host_id
        and (sa.scope = 'workbook' or sa.conversation_id = conversations.id)
    )
  );

create policy "messages shared read"
  on public.messages for select
  using (
    exists (
      select 1 from public.shared_access sa
      join public.conversations c on c.id = messages.conversation_id
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = c.host_id
        and (sa.scope = 'workbook' or sa.conversation_id = messages.conversation_id)
    )
  );

create policy "referrals shared read"
  on public.referrals for select
  using (
    exists (
      select 1 from public.shared_access sa
      where sa.shared_with_id = auth.uid()
        and sa.revoked_at is null
        and sa.owner_id = referrals.host_id
        and (
          sa.scope = 'workbook'
          or (sa.scope = 'conversation' and sa.conversation_id = referrals.conversation_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Accept pending invites at signup. Extends the existing handle_new_user()
-- trigger function (same signature, same trigger) rather than adding a
-- second trigger, so account bootstrapping stays in one place.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;

  insert into public.shared_access (owner_id, shared_with_id, scope, conversation_id, granted_at)
  select owner_id, new.id, scope, conversation_id, now()
  from public.shared_access_invites
  where lower(invited_email) = lower(new.email)
    and accepted_at is null;

  update public.shared_access_invites
  set accepted_at = now()
  where lower(invited_email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;
