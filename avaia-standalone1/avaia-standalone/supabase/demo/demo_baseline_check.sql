-- AVAIA DEMONSTRATION: BASELINE CHECK. READ-ONLY. Run in the avaia-demo project. Changes nothing.
-- Returns PASS / FAIL rows for the exact state demo_reset_and_seed.sql writes, then an overall result.
-- Run it AFTER every reset, and BEFORE you present. If anything says FAIL, run demo_reset_and_seed.sql again.
with ids as (
  select (select id from auth.users where lower(email) = 'kidathart+avaia-demo-host@gmail.com')  as host,
         (select id from auth.users where lower(email) = 'kidathart+avaia-demo-guide@gmail.com') as guide
),
c as (
  select 1 as ord, 'both demo accounts exist, and no other account exists' as check_name,
         ((select host from ids) is not null and (select guide from ids) is not null and (select count(*) from auth.users) = 2) as ok,
         (select count(*) from auth.users)::text || ' account(s) in this database' as detail
  union all select 2, 'Host has consent recorded and is an adult account',
         coalesce((select consent_at is not null and adult_confirmed and developmental_band is null from public.profiles where id = (select host from ids)), false), 'profile of the demo Host'
  union all select 3, 'Guide is eligible for Guide Coordination (certified, authorized, named)',
         coalesce(public.coordination_guide_is_eligible((select guide from ids)), false)
           and coalesce((select guide_display_name = 'Nora Castellane' from public.profiles where id = (select guide from ids)), false),
         'active certification + coordination_support + display name Nora Castellane'
  union all select 4, 'both demo accounts carry the designated-test marker',
         (select count(*) from public.entitlements where host_id in (select host from ids union select guide from ids) and source = 'founder_test' and status = 'active') = 2, 'founder_test entitlements'
  union all select 5, 'one completed Journey',
         (select count(*) from public.journeys where host_id = (select host from ids) and completed_at is not null) = 1, 'journeys'
  union all select 6, 'IAP, CAT and InnerCompass conversations, all complete',
         (select count(*) from public.conversations where host_id = (select host from ids) and status = 'complete' and stage in ('iap','cat','innercompass')) = 3
           and (select count(distinct stage) from public.conversations where host_id = (select host from ids)) = 3, 'conversations'
  union all select 7, 'three referrals, one per conversation',
         (select count(*) from public.referrals where host_id = (select host from ids)) = 3, 'referrals'
  union all select 8, 'the Journey messages are in place (23)',
         (select count(*) from public.messages m join public.conversations cv on cv.id = m.conversation_id where cv.host_id = (select host from ids)) = 23, 'messages'
  union all select 9, 'four Coordination items: one decision, Open x2, Waiting x1, Closed x1',
         (select count(*) from public.coordination_items where host_id = (select host from ids)) = 4
           and (select count(*) from public.coordination_items where host_id = (select host from ids) and kind = 'decision') = 1
           and (select count(*) from public.coordination_items where host_id = (select host from ids) and status = 'open') = 2
           and (select count(*) from public.coordination_items where host_id = (select host from ids) and status = 'waiting') = 1
           and (select count(*) from public.coordination_items where host_id = (select host from ids) and status = 'closed') = 1, 'items by kind and status'
  union all select 10, 'continuity record: 8 entries, 7 live, 1 withdrawn, on the decision',
         (select count(*) from public.coordination_entries where host_id = (select host from ids)) = 8
           and (select count(*) from public.coordination_entries where host_id = (select host from ids) and withdrawn_at is null) = 7
           and (select count(*) from public.coordination_entries where host_id = (select host from ids) and withdrawn_at is not null) = 1
           and (select count(*) from public.coordination_entries e join public.coordination_items i on i.id = e.item_id where e.host_id = (select host from ids) and i.kind = 'decision') = 8, 'entries'
  union all select 11, 'the entries span several dates (earliest at least 30 days back)',
         (select min(occurred_at) from public.coordination_entries where host_id = (select host from ids)) < now() - interval '30 days', 'earliest entry date'
  union all select 12, 'no share exists yet (the handoff is done live)',
         (select count(*) from public.coordination_shares where host_id = (select host from ids)) = 0, 'shares'
  union all select 13, 'no Guide access exists yet (the grant is done live)',
         (select count(*) from public.coordination_guide_grants where host_id = (select host from ids)) = 0
           and (select count(*) from public.coordination_guide_events where host_id = (select host from ids)) = 0, 'grants and Guide notes'
)
select check_name, result, detail from (
  select ord, check_name, case when ok then 'PASS' else 'FAIL' end as result, detail from c
  union all
  select 99, 'OVERALL DEMO BASELINE', case when (select count(*) from c where not ok) = 0 then 'PASS' else 'FAIL' end,
         (select count(*) from c where ok) || ' of 13 checks pass'
) x
order by ord;
