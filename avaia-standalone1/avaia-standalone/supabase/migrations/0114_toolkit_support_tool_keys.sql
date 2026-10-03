-- 0114: the Toolkit support items table (0108) allowed 13 tool names; the Toolkit
-- registry (lib/toolkit.ts) now has 16. Without this, a Guide could not report a
-- problem or make a request about Youth Defying Grief, The View From Above, or
-- Youth View From Above. Additive: every name accepted before is still accepted.
-- Safe to run more than once.
do $$
begin
  if to_regclass('public.toolkit_support_items') is not null then
    alter table public.toolkit_support_items drop constraint if exists toolkit_support_items_tool_key_check;
    alter table public.toolkit_support_items
      add constraint toolkit_support_items_tool_key_check
      check (tool_key in (
        'preparation', 'iap', 'cat', 'innercompass',
        'secondary-loss', 'chemistry', 'table-formation',
        'council', 'give', 'defying-grief', 'unsung-heroes',
        'library', 'youth-group',
        'youth-defying-grief', 'view-from-above', 'youth-view-from-above'
      ));
  end if;
end $$;

-- Verification (read-only): the constraint now accepts all 16 registry names.
select pg_get_constraintdef(oid) like '%youth-view-from-above%' as all_tool_names_accepted
from pg_constraint where conname = 'toolkit_support_items_tool_key_check';
