-- READ-ONLY. Run BEFORE applying migration 0082.
-- Lists every existing certification, the expiration the locked rule would
-- give it (certification date + 365 days), and whether it would become
-- INACTIVE the first time the daily Guide Operations run executes after the
-- migration. Changes nothing.
select
  gc.id            as certification_id,
  gc.host_id,
  u.email,
  gc.standing,
  gc.certified_at::date                          as certified_on,
  (gc.certified_at + interval '365 days')::date  as would_expire_on,
  (gc.certified_at + interval '365 days') < now() as already_expired_under_locked_rule,
  case
    when gc.standing = 'active' and (gc.certified_at + interval '365 days') < now()
      then 'WOULD BECOME INACTIVE IMMEDIATELY - owner decision required'
    when gc.standing <> 'active' and (gc.certified_at + interval '365 days') < now()
      then 'not active now; would be past due if ever returned to active'
    else 'ok'
  end as review_status
from public.guide_certifications gc
left join auth.users u on u.id = gc.host_id
order by gc.certified_at;
