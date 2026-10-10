-- AVAIA DEMO ONLY. Aligns the demo database with Production on the one remaining difference.
-- Finding: migration 0029 (guide read access) creates four rules that let a Guide read a Host's journeys, conversations, messages and
-- referrals directly. Production does NOT have them (verified 2026-10-09 by listing Production's rules on those four tables).
-- The demo is meant to match Production, so those four rules are removed here, in the DEMO database only.
-- SAFETY GUARD: this script REFUSES to run in any database that has user accounts. The demo is empty of users; Production is not.
do $$
begin
  if (select count(*) from auth.users) > 0 then
    raise exception 'REFUSED: this database has user accounts. This script is for the empty demo database only.';
  end if;
end $$;

drop policy if exists "journeys guide read" on public.journeys;
drop policy if exists "conversations guide read" on public.conversations;
drop policy if exists "messages guide read" on public.messages;
drop policy if exists "referrals guide read" on public.referrals;

select (select count(*) from pg_policies where schemaname = 'public' and policyname in
          ('journeys guide read', 'conversations guide read', 'messages guide read', 'referrals guide read')) as guide_read_rules_left_expect_0,
       (select count(*) from pg_policies where schemaname = 'public') as total_rules_expect_203;
