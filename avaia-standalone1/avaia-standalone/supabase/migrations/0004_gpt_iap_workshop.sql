-- GPT IAP workshop — OAuth provider tables. Run once against the live
-- database (Supabase SQL editor), after 0001-0003.
--
-- AVAIA acts as a minimal OAuth 2.0 authorization-code provider for exactly
-- one client: the real IAP custom GPT's Action. The Host authenticates once,
-- through a real consent screen, instead of any value the model has to
-- remember and reproduce across a conversation.
--
-- oauth_authorization_codes — short-lived, single-use, created the moment
-- the Host approves the consent screen; exchanged by OpenAI's servers
-- (not the Host's browser) for an access token.
--
-- oauth_access_tokens — the bearer token the Action actually sends on every
-- call afterward. Bound to a host_id; that binding is what lets the
-- referral endpoint resolve identity without any value the model carries.
--
-- Both locked out of anon/authenticated entirely (RLS enabled, zero
-- policies) — service-role only, same posture as the Stripe webhook.

create table if not exists public.oauth_authorization_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  host_id          uuid not null references auth.users (id) on delete cascade,
  client_id        text not null,
  redirect_uri     text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz
);

create index if not exists oauth_authorization_codes_code_idx on public.oauth_authorization_codes (code);

alter table public.oauth_authorization_codes enable row level security;

create table if not exists public.oauth_access_tokens (
  id               uuid primary key default gen_random_uuid(),
  access_token     text not null unique,
  host_id          uuid not null references auth.users (id) on delete cascade,
  client_id        text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz,
  revoked_at       timestamptz
);

create index if not exists oauth_access_tokens_token_idx on public.oauth_access_tokens (access_token);
create index if not exists oauth_access_tokens_host_idx on public.oauth_access_tokens (host_id);

alter table public.oauth_access_tokens enable row level security;
-- Deliberately no policies on either table — service-role only, by design.
