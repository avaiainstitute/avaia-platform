-- "What Still Needs to Be Said" -- a distinct AVAIA conversational
-- capability, fully separate from the IAP/CAT/InnerCompass Journey and from
-- Unsung Heroes. Modeled directly on unsung_heroes_conversations /
-- unsung_heroes_messages (0007-era migration) -- same shape, same
-- self-only privacy posture, same reasons: nothing here can affect or be
-- affected by the core Journey engine's tables or logic.
--
-- recipient is free text (the Host's own words for who they need to talk
-- to -- "Dad", "my ex-wife", "someone I lost") -- never a constrained
-- enum, since forcing relationship categories was explicitly ruled out.
--
-- grounding is optional free text the Host may provide (memories, things
-- the person actually said, characteristic phrases) to help ground a
-- generated response -- never required to start the conversation.

create table if not exists public.unsaid_conversations (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users (id) on delete cascade,
  recipient     text not null,
  grounding     text,
  status        text not null default 'active' check (status in ('active', 'complete')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists unsaid_conversations_host_id_idx on public.unsaid_conversations (host_id);

alter table public.unsaid_conversations enable row level security;
create policy "unsaid conversations are self-only"
  on public.unsaid_conversations for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- wants_response records what the Host actually chose for that turn (only
-- meaningful on role='host' rows) -- the API never generates a 'guide' row
-- for a host turn where this is false, so the absence of a reply is a
-- deliberate, visible choice rather than a missing/failed response.
create table if not exists public.unsaid_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.unsaid_conversations (id) on delete cascade,
  host_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('host', 'guide')),
  content          text not null,
  wants_response   boolean,
  created_at       timestamptz not null default now()
);

create index if not exists unsaid_messages_conversation_id_idx on public.unsaid_messages (conversation_id);

alter table public.unsaid_messages enable row level security;
create policy "unsaid messages are self-only"
  on public.unsaid_messages for all
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Widen the AI usage telemetry check constraint for this feature's tag,
-- same pattern as 0059's iap_origin_opening addition.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_feature_check;
alter table public.ai_usage_events add constraint ai_usage_events_feature_check
  check (feature in (
    'iap_conversation', 'cat_conversation', 'innercompass_conversation',
    'iap_referral', 'cat_referral', 'innercompass_referral',
    'cat_opening', 'innercompass_opening', 'iap_origin_opening',
    'unsung_heroes_recognition', 'unsung_heroes_conversation',
    'chemistry_virtue_formula', 'transcript_cleanup',
    'preparation_snapshot', 'preparation_chat',
    'room_conversation', 'room_referral',
    'unsaid_conversation'
  ));
