-- AVAIA DEMO: schema snapshot fingerprint. READ-ONLY. Safe to run in Production.
-- Run this SAME file in Production and, later, in the demo project, and compare the two result tables.
-- It only reads: it calls the existing avaia_schema_snapshot() function (catalog metadata: table names, RLS flags, policy
-- names and rule text, trigger names, check constraints, function names; never a row of data), and counts columns from
-- the catalog. The volatile 'generated_at' field is removed so identical structure gives an identical fingerprint.
with snap as (select public.avaia_schema_snapshot() - 'generated_at' as j),
cols as (
  select count(*) as n
  from information_schema.columns k
  join pg_class c on c.relname = k.table_name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  where k.table_schema = 'public'
)
select 1 as ord, 'fingerprint of the whole structure' as what, md5(j::text) as value from snap
union all select 2, 'tables (public)',                   jsonb_array_length(j -> 'tables')::text from snap
union all select 3, 'columns (all public tables)',       n::text from cols
union all select 4, 'database functions (public)',       jsonb_array_length(j -> 'functions')::text from snap
union all select 5, 'policies (all tables)',             (select coalesce(sum(jsonb_array_length(t -> 'policies')), 0) from jsonb_array_elements(j -> 'tables') t)::text from snap
union all select 6, 'triggers (all tables)',             (select coalesce(sum(jsonb_array_length(t -> 'triggers')), 0) from jsonb_array_elements(j -> 'tables') t)::text from snap
union all select 7, 'check constraints (all tables)',    (select coalesce(sum((select count(*) from jsonb_object_keys(t -> 'checks'))), 0) from jsonb_array_elements(j -> 'tables') t)::text from snap
union all select 8, 'tables with row level security on', (select count(*) from jsonb_array_elements(j -> 'tables') t where (t ->> 'rls')::boolean)::text from snap
order by ord;
