-- 0124_coordination_guide_cascade.sql
--
-- Corrects one defect found by the rolled-back behavior test of 0123: deleting a Host's account failed, because
-- the Phase 4 tables pointed at the Host's items and entries with a plain (no-action) foreign key. When an
-- account is removed the database deletes the Host's items and entries, and the Guide scope rows and Guide
-- records that still pointed at them blocked it.
--
-- Items and entries are never deleted any other way (no delete policy or privilege exists), so making these
-- three foreign keys cascade changes nothing a Host or a Guide can do. It only lets an account's removal
-- complete cleanly, as it does for Phases 1 to 3.
--
-- Safe to run more than once.

-- scope -> item
alter table public.coordination_guide_scope
  drop constraint if exists coordination_guide_scope_item_fk;
alter table public.coordination_guide_scope
  add constraint coordination_guide_scope_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id) on delete cascade;

-- scope -> entry (the inline foreign key from 0123, whatever it was named, is replaced)
do $$
declare
  fk record;
begin
  for fk in
    select k.conname
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'entry_id' and a.attnum = any (k.conkey)
     where n.nspname = 'public' and c.relname = 'coordination_guide_scope' and k.contype = 'f'
       and k.confrelid = 'public.coordination_entries'::regclass
  loop
    execute format('alter table public.coordination_guide_scope drop constraint %I', fk.conname);
  end loop;
end $$;
alter table public.coordination_guide_scope
  add constraint coordination_guide_scope_entry_fk
    foreign key (entry_id) references public.coordination_entries (id) on delete cascade;

-- events -> item
alter table public.coordination_guide_events
  drop constraint if exists coordination_guide_events_item_fk;
alter table public.coordination_guide_events
  add constraint coordination_guide_events_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id) on delete cascade;
