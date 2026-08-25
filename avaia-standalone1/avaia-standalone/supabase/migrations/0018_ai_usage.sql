-- AI usage instrumentation -- operational telemetry only, never Host content.
-- Records raw token counts per Anthropic call so cost-per-Host/cost-per-Journey
-- can be calculated later from a centralized, effective-dated pricing model
-- (not part of this migration). Written exclusively by the service-role
-- client from lib/engine/ai-usage.ts; no Host-facing RLS policy exists, so
-- this table is never queryable through the normal browser/session client.
create table if not exists public.ai_usage_events (
  id                           uuid primary key default gen_random_uuid(),
  host_id                      uuid references auth.users (id) on delete cascade,
  -- Not a foreign key: this column holds either a public.conversations id
  -- (Journey conversation turns, referrals, openings) or an Unsung Heroes
  -- conversation id, depending on feature -- two different source tables,
  -- so it's stored as a plain identifier rather than constrained to one.
  conversation_id              uuid,
  feature                      text not null check (feature in (
                                  'iap_conversation', 'cat_conversation', 'innercompass_conversation',
                                  'iap_referral', 'cat_referral', 'innercompass_referral',
                                  'cat_opening', 'innercompass_opening',
                                  'unsung_heroes_recognition', 'unsung_heroes_conversation',
                                  'chemistry_virtue_formula', 'transcript_cleanup'
                                )),
  stage                        text check (stage in ('iap', 'cat', 'innercompass')),
  model                        text not null,
  input_tokens                 integer not null,
  output_tokens                 integer not null,
  cache_creation_input_tokens  integer not null default 0,
  cache_read_input_tokens      integer not null default 0,
  created_at                   timestamptz not null default now()
);

create index if not exists ai_usage_events_host_idx on public.ai_usage_events (host_id, created_at);
create index if not exists ai_usage_events_feature_idx on public.ai_usage_events (feature, created_at);

alter table public.ai_usage_events enable row level security;
-- Deliberately no policy: operational telemetry, not Host content. Only the
-- service-role client (bypasses RLS) ever reads or writes this table.
