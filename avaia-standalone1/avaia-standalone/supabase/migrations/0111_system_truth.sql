-- 0111_system_truth.sql
--
-- "AVAIA tells the truth about itself" (Convergence Move 1). Two small,
-- additive things; neither touches a row of Host, Guide, candidate, or
-- participant data.
--
-- 1. cron_runs accepts the two scheduled jobs that did not record their runs
--    before (system-checks, prospect-research), so every job in vercel.json
--    can be watched. Guarded: skipped if cron_runs does not exist.
--
-- 2. public.avaia_schema_snapshot(): a READ-ONLY function that returns the
--    database's own description of itself (table names, whether row-level
--    security is on, policy NAMES and rule text, trigger names, constraint
--    definitions, function names). It reads the system catalog only, never a
--    table's contents. The system checks use it to confirm that row-level
--    security is on everywhere and that a few protective rules are in place.
--    It can be called only by the server's service role: it is closed to the
--    public, to anonymous visitors, and to signed-in users.
--
-- Safe to run more than once.

-- 1. Cron names ---------------------------------------------------------------
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
        'system-checks', 'prospect-research'
      ));
  end if;
end $$;

-- 2. Catalog snapshot (metadata only) -------------------------------------------
create or replace function public.avaia_schema_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'tables', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', c.relname,
          'rls', c.relrowsecurity,
          'policies', coalesce((
            select jsonb_agg(jsonb_build_object(
              'name', p.polname,
              'cmd', p.polcmd,
              'qual', pg_get_expr(p.polqual, p.polrelid),
              'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
            ) order by p.polname)
            from pg_policy p where p.polrelid = c.oid
          ), '[]'::jsonb),
          'triggers', coalesce((
            select jsonb_agg(t.tgname order by t.tgname)
            from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal
          ), '[]'::jsonb),
          'checks', coalesce((
            select jsonb_object_agg(k.conname, pg_get_constraintdef(k.oid))
            from pg_constraint k where k.conrelid = c.oid and k.contype = 'c'
          ), '{}'::jsonb)
        ) order by c.relname)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ), '[]'::jsonb),
    'functions', coalesce((
      select jsonb_agg(f.proname order by f.proname)
      from (
        select distinct p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      ) f
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.avaia_schema_snapshot() from public;
revoke all on function public.avaia_schema_snapshot() from anon, authenticated;
grant execute on function public.avaia_schema_snapshot() to service_role;

comment on function public.avaia_schema_snapshot() is
  'Read-only description of the database structure (names, row-level-security flags, policy and trigger names, constraint text). Catalog metadata only; never reads table contents. Service role only.';

-- Verification (read-only): the function exists and answers, row-level
-- security is on for every table in the public schema, and cron_runs accepts
-- all ten job names.
select
  (select jsonb_array_length(public.avaia_schema_snapshot() -> 'tables'))                        as tables_in_database,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity)                     as tables_without_rls,
  (select pg_get_constraintdef(oid) like '%prospect-research%'
    from pg_constraint where conname = 'cron_runs_cron_name_check')                              as cron_names_updated;
