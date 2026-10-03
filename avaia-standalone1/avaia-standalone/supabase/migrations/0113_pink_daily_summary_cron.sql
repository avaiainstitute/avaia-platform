-- 0113: the Pink Shoelace Foundation gets its own daily summary, separate from
-- AVAIA's Founder Digest, so cron_runs must accept its job name.
-- Additive and safe to run more than once. Nothing is deleted; every name the
-- constraint accepted before is still accepted (including the retired
-- 'certification-operations', whose past runs stay on record).
do $$
begin
  if to_regclass('public.cron_runs') is not null then
    alter table public.cron_runs drop constraint if exists cron_runs_cron_name_check;
    alter table public.cron_runs
      add constraint cron_runs_cron_name_check
      check (cron_name in (
        'host-onboarding', 'guide-operations', 'founder-digest',
        'entitlement-reconciliation', 'guardian-consent-reminder',
        'family-invite-reminder',
        'certification-operations', 'certification-companion',
        'system-checks', 'prospect-research',
        'pink-daily-summary'
      ));
  end if;
end $$;

-- Verification (read-only): the constraint now accepts the Pink summary job.
select pg_get_constraintdef(oid) like '%pink-daily-summary%' as pink_job_accepted
from pg_constraint where conname = 'cron_runs_cron_name_check';
