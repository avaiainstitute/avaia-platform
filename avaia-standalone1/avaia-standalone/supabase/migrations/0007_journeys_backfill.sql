-- Journey continuity, step 1b — deterministic backfill of journey_id for
-- conversations created before 0006_journeys.sql existed.
--
-- Unlike 0006, this touches existing rows, not just structure — review
-- before running, and run it AFTER 0006 (requires public.journeys and
-- conversations.journey_id to already exist). Safe to re-run: every step
-- only ever acts on rows where journey_id is currently null.
--
-- No timestamp-proximity guessing across a host's whole history. Every
-- linkage below comes from an explicit relationship already in the data:
-- referrals.conversation_id (exact -- the conversation a referral came
-- from) plus a tight creation-time correlation to the resulting next-stage
-- conversation, since createConversation runs within seconds of the
-- referral insert, in the same request. Where more than one candidate
-- matches or none does, the conversation is left unresolved (journey_id
-- stays null) rather than guessed -- per the explicit instruction not to
-- store a false relationship.

-- Step 1: every not-yet-linked IAP conversation seeds its own Journey.
-- Nothing points TO an IAP conversation (referrals only point FROM a
-- source conversation), so every IAP conversation is journey-safe on its
-- own -- this also covers standalone/incomplete IAP conversations that
-- never produced a referral at all.
do $$
declare
  r record;
  new_journey_id uuid;
begin
  for r in
    select id, host_id, program, created_at
    from public.conversations
    where stage = 'iap' and journey_id is null
    order by created_at
  loop
    insert into public.journeys (host_id, program, started_at)
    values (r.host_id, r.program, r.created_at)
    returning id into new_journey_id;

    update public.conversations
    set journey_id = new_journey_id
    where id = r.id;
  end loop;
end $$;

-- Step 2: walk every referral in chronological order (so a CAT
-- conversation gets its journey_id before any CAT -> InnerCompass referral
-- that depends on it is processed). For each, find the single unlinked
-- next-stage conversation for the same host+program created within a tight
-- window right after the referral. Link it only if there is exactly one
-- candidate.
do $$
declare
  ref record;
  candidate_count int;
  candidate_id uuid;
  window_seconds int := 60;
begin
  for ref in
    select r.id as referral_id, r.host_id, r.to_stage, r.created_at,
           sc.journey_id as source_journey_id, sc.program as source_program
    from public.referrals r
    join public.conversations sc on sc.id = r.conversation_id
    where r.to_stage in ('cat', 'innercompass')
    order by r.created_at
  loop
    if ref.source_journey_id is null then
      continue; -- source conversation itself unresolved; leave this hop unresolved too
    end if;

    select count(*), max(id) into candidate_count, candidate_id
    from public.conversations c
    where c.host_id = ref.host_id
      and c.stage = ref.to_stage
      and c.program = ref.source_program
      and c.journey_id is null
      and c.created_at >= ref.created_at
      and c.created_at <= ref.created_at + (window_seconds || ' seconds')::interval;

    if candidate_count = 1 then
      update public.conversations
      set journey_id = ref.source_journey_id
      where id = candidate_id;
    end if;
    -- 0 or >1 candidates: left unresolved on purpose, not guessed.
  end loop;
end $$;

-- Step 3: reconcile completed_at for journeys whose InnerCompass stage
-- already finished.
update public.journeys j
set completed_at = c.completed_at
from public.conversations c
where c.journey_id = j.id
  and c.stage = 'innercompass'
  and c.status = 'complete'
  and j.completed_at is null;

-- Verification -- review this before trusting the backfill. "unresolved"
-- conversations are legacy/ambiguous by design, not an error.
select stage,
       count(*) filter (where journey_id is not null) as linked,
       count(*) filter (where journey_id is null) as unresolved
from public.conversations
group by stage
order by stage;
