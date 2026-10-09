-- 0123_coordination_guide.sql
--
-- Coordination layer, Phase 4: Guide Coordination (Decision 0011).
--
-- A Host can give ONE eligible Guide a time-limited, revocable window onto the coordination items (and,
-- separately, the continuity entries) the Host chooses. Nothing is included by default. The Guide reads
-- through narrow SECURITY DEFINER functions and never gets table access to the Host's records. The Guide can
-- record Guide-authored notes and follow-up marks; the Guide can change nothing the Host owns.
--
--   coordination_guide_grants   one row per Host authorization to one Guide, with a required end date
--                               (1 to 90 days) and a revoke that can never be undone.
--   coordination_guide_scope    what the Host chose to include: a row without an entry is "this item is
--                               visible"; a row with an entry is "this entry is visible". Kept normalized
--                               (not an id list inside the grant) so each choice has its own foreign key,
--                               its own added and removed time, and can be re-verified by the database.
--   coordination_guide_events   everything a Guide records: notes, follow-up marks, a flag for the Host.
--                               Append-only; the Guide may withdraw their own, the Host may acknowledge a
--                               flag; nothing is ever deleted. Never part of coordination_entries and never
--                               part of a Phase 3 share.
--
-- Integrity, enforced by the database and not only by the application:
--   * A Guide must satisfy ALL of these on every access, re-checked fresh each time (no cache): an active
--     certification, an authorized `coordination_support` capability, an active unexpired Host grant, and
--     the item or entry inside that grant's scope.
--   * Nothing is inherited. Guided Journey access, Toolkit access, Shared Room participation and
--     organization connections grant nothing here.
--   * No admin policy of any kind on the three new tables. No delete policy.
--   * The Guide has NO select privilege on coordination_items, coordination_entries or coordination_shares.
--     The view function returns only the permitted fields. A Shared Room entry cannot be placed in scope.
--   * A grant, a scope row and an event can never be edited. The only things that ever change are
--     revoked_at (Host, once), removed_at (Host, once), withdrawn_at (the author Guide, once) and
--     acknowledged_at (the Host, once).
--   * Adult accounts only, for both the Host and the Guide.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------------------------------------
-- 1. The capability. Widens the existing check, exactly as 0026 did for guided_journey_facilitation.
-- ---------------------------------------------------------------------------------------------------------
alter table public.guide_platform_authorizations
  drop constraint if exists guide_platform_authorizations_capability_check;
alter table public.guide_platform_authorizations
  add constraint guide_platform_authorizations_capability_check
    check (capability in ('toolkit', 'guided_journey_facilitation', 'coordination_support'));

-- ---------------------------------------------------------------------------------------------------------
-- 2. Eligibility. Computed fresh, never cached. SECURITY DEFINER because the certification and
--    authorization tables are readable only by their owner and admins.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.coordination_guide_is_eligible(p_guide uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select p_guide is not null
    and exists (select 1 from public.guide_certifications gc where gc.host_id = p_guide and gc.standing = 'active')
    and exists (
      select 1 from public.guide_platform_authorizations gpa
       where gpa.host_id = p_guide and gpa.capability = 'coordination_support' and gpa.status = 'authorized')
    and not exists (select 1 from public.profiles p where p.id = p_guide and p.developmental_band is not null)
$$;

-- The list a Host chooses from: display name only. Never includes the caller.
create or replace function public.list_eligible_coordination_guides()
returns table (guide_id uuid, guide_display_name text)
language sql security definer stable set search_path = public as $$
  select p.id, p.guide_display_name
    from public.profiles p
   where p.guide_display_name is not null and btrim(p.guide_display_name) <> ''
     and p.id is distinct from auth.uid()
     and public.coordination_guide_is_eligible(p.id)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. coordination_guide_grants
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.coordination_guide_grants (
  id                      uuid primary key default gen_random_uuid(),
  host_id                 uuid not null references auth.users (id) on delete cascade,
  guide_id                uuid not null references auth.users (id) on delete cascade,

  -- The name the Host wants the Guide to see for them. Typed by the Host; nothing is read from a profile.
  host_label              text not null check (char_length(btrim(host_label)) between 1 and 200),
  -- What the Host authorized, stored verbatim.
  authorization_statement text not null check (char_length(btrim(authorization_statement)) between 1 and 4000),

  granted_at              timestamptz not null default now(),
  -- The Host chooses 1 to 90 days; the database computes the end from its own clock. There is no extension:
  -- to continue, the Host authorizes a new grant.
  valid_days              smallint not null check (valid_days between 1 and 90),
  ends_at                 timestamptz not null,
  revoked_at              timestamptz,

  constraint coordination_guide_grants_id_host_unique unique (id, host_id),
  constraint coordination_guide_grants_id_host_guide_unique unique (id, host_id, guide_id),
  constraint coordination_guide_grants_not_self check (host_id <> guide_id),
  constraint coordination_guide_grants_window
    check (ends_at = granted_at + ((valid_days * 24) * interval '1 hour'))
);

create index if not exists coordination_guide_grants_host_idx
  on public.coordination_guide_grants (host_id, granted_at desc);
create index if not exists coordination_guide_grants_guide_idx
  on public.coordination_guide_grants (guide_id, granted_at desc);

alter table public.coordination_guide_grants enable row level security;

revoke all on public.coordination_guide_grants from anon, authenticated;
grant select on public.coordination_guide_grants to authenticated;
grant insert (host_id, guide_id, host_label, authorization_statement, valid_days) on public.coordination_guide_grants to authenticated;
grant update (revoked_at) on public.coordination_guide_grants to authenticated;

-- Host read: their own grants. Guide read: grants made to them (so they can see their own history).
do $$ begin
  create policy "coordination guide grants host read" on public.coordination_guide_grants
    for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide grants guide read" on public.coordination_guide_grants
    for select using (guide_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Host create: their own grant, an adult account. The trigger verifies the Guide and stamps the times.
do $$ begin
  create policy "coordination guide grants host insert" on public.coordination_guide_grants
    for insert with check (
      host_id = auth.uid()
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.developmental_band is not null)
    );
exception when duplicate_object then null; end $$;

-- Host revoke: their own grants. Deliberately not limited to adults or to eligible Guides: revoking must
-- never be blocked. The guard trigger and the column privilege limit this to revoked_at.
do $$ begin
  create policy "coordination guide grants host revoke" on public.coordination_guide_grants
    for update using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Deliberately NO admin policy and NO delete policy.

create or replace function public.coordination_guide_grants_check_insert() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.host_id and p.developmental_band is not null) then
    raise exception 'Guide coordination is available to adult accounts in this release.';
  end if;
  if not public.coordination_guide_is_eligible(new.guide_id) then
    raise exception 'That Guide is not currently available for coordination support.';
  end if;
  if exists (
    select 1 from public.coordination_guide_grants g
     where g.host_id = new.host_id and g.guide_id = new.guide_id
       and g.revoked_at is null and g.ends_at > now()
  ) then
    raise exception 'This Guide already has active access. Revoke it first to start a new one.';
  end if;
  new.granted_at := now();
  new.ends_at := now() + ((new.valid_days * 24) * interval '1 hour');
  new.revoked_at := null;
  return new;
end $$;

drop trigger if exists coordination_guide_grants_check_insert on public.coordination_guide_grants;
create trigger coordination_guide_grants_check_insert before insert on public.coordination_guide_grants
  for each row execute function public.coordination_guide_grants_check_insert();

-- Guard: a grant is never edited. Only revoked_at moves, once, stamped by the database, never undone.
create or replace function public.coordination_guide_grants_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.host_id is distinct from old.host_id
     or new.guide_id is distinct from old.guide_id
     or new.host_label is distinct from old.host_label
     or new.authorization_statement is distinct from old.authorization_statement
     or new.granted_at is distinct from old.granted_at
     or new.valid_days is distinct from old.valid_days
     or new.ends_at is distinct from old.ends_at then
    raise exception 'A Guide access grant cannot be changed after it is authorized.';
  end if;
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  elsif new.revoked_at is not null then
    new.revoked_at := now();
  end if;
  return new;
end $$;

drop trigger if exists coordination_guide_grants_guard on public.coordination_guide_grants;
create trigger coordination_guide_grants_guard before update on public.coordination_guide_grants
  for each row execute function public.coordination_guide_grants_guard();

-- Is this grant live for this Guide right now? Used by policies and checks, so no caller has to be able to
-- read the scope table itself.
create or replace function public.coordination_guide_grant_active(p_grant uuid, p_guide uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
           select 1 from public.coordination_guide_grants g
            where g.id = p_grant and g.guide_id = p_guide and g.revoked_at is null and g.ends_at > now())
     and public.coordination_guide_is_eligible(p_guide)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. coordination_guide_scope
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.coordination_guide_scope (
  id          uuid primary key default gen_random_uuid(),
  grant_id    uuid not null,
  host_id     uuid not null,
  item_id     uuid not null,
  -- Null: the item is visible. Set: that one entry is visible (the item must be visible too).
  entry_id    uuid references public.coordination_entries (id),
  added_at    timestamptz not null default now(),
  removed_at  timestamptz,

  constraint coordination_guide_scope_grant_fk
    foreign key (grant_id, host_id) references public.coordination_guide_grants (id, host_id) on delete cascade,
  constraint coordination_guide_scope_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id)
);

-- One live row per item and per entry for a grant.
create unique index if not exists coordination_guide_scope_item_live
  on public.coordination_guide_scope (grant_id, item_id) where entry_id is null and removed_at is null;
create unique index if not exists coordination_guide_scope_entry_live
  on public.coordination_guide_scope (grant_id, entry_id) where entry_id is not null and removed_at is null;
create index if not exists coordination_guide_scope_grant_idx
  on public.coordination_guide_scope (grant_id, item_id);
create index if not exists coordination_guide_scope_host_idx
  on public.coordination_guide_scope (host_id);

alter table public.coordination_guide_scope enable row level security;

revoke all on public.coordination_guide_scope from anon, authenticated;
grant select on public.coordination_guide_scope to authenticated;
grant insert (grant_id, host_id, item_id, entry_id) on public.coordination_guide_scope to authenticated;
grant update (removed_at) on public.coordination_guide_scope to authenticated;

-- Only the Host. The Guide has no policy here at all: they learn their scope only through the view function.
do $$ begin
  create policy "coordination guide scope host read" on public.coordination_guide_scope
    for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide scope host insert" on public.coordination_guide_scope
    for insert with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide scope host remove" on public.coordination_guide_scope
    for update using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.coordination_guide_scope_check_insert() returns trigger
language plpgsql set search_path = public as $$
declare
  ent record;
begin
  if not exists (
    select 1 from public.coordination_guide_grants g
     where g.id = new.grant_id and g.host_id = new.host_id and g.revoked_at is null and g.ends_at > now()
  ) then
    raise exception 'Choose what to include only for a Guide whose access is active.';
  end if;
  if exists (select 1 from public.profiles p where p.id = new.host_id and p.developmental_band is not null) then
    raise exception 'Guide coordination is available to adult accounts in this release.';
  end if;

  if new.entry_id is not null then
    select ce.host_id, ce.item_id, ce.withdrawn_at, ce.source_kind
      into ent
      from public.coordination_entries ce
     where ce.id = new.entry_id;
    if not found or ent.host_id is distinct from new.host_id or ent.item_id is distinct from new.item_id then
      raise exception 'That entry is not one of this decision''s entries.';
    end if;
    if ent.withdrawn_at is not null then
      raise exception 'A withdrawn entry cannot be shown to a Guide.';
    end if;
    if ent.source_kind = 'room_message' then
      raise exception 'Words from a Shared Room are not shown to a Guide.';
    end if;
    if not exists (
      select 1 from public.coordination_guide_scope s
       where s.grant_id = new.grant_id and s.item_id = new.item_id
         and s.entry_id is null and s.removed_at is null
    ) then
      raise exception 'Include the decision first, then choose its entries.';
    end if;
  end if;

  new.added_at := now();
  new.removed_at := null;
  return new;
end $$;

drop trigger if exists coordination_guide_scope_check_insert on public.coordination_guide_scope;
create trigger coordination_guide_scope_check_insert before insert on public.coordination_guide_scope
  for each row execute function public.coordination_guide_scope_check_insert();

-- Guard: a scope row is never edited. removed_at is stamped once by the database and never undone.
create or replace function public.coordination_guide_scope_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.grant_id is distinct from old.grant_id
     or new.host_id is distinct from old.host_id
     or new.item_id is distinct from old.item_id
     or new.entry_id is distinct from old.entry_id
     or new.added_at is distinct from old.added_at then
    raise exception 'What was included for a Guide cannot be edited; it can only be removed.';
  end if;
  if old.removed_at is not null then
    new.removed_at := old.removed_at;
  elsif new.removed_at is not null then
    new.removed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists coordination_guide_scope_guard on public.coordination_guide_scope;
create trigger coordination_guide_scope_guard before update on public.coordination_guide_scope
  for each row execute function public.coordination_guide_scope_guard();

-- Removing an item also removes its chosen entries, so adding the item back later can never silently
-- expose entries the Host chose under the earlier selection.
create or replace function public.coordination_guide_scope_after_remove() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.entry_id is null and old.removed_at is null and new.removed_at is not null then
    update public.coordination_guide_scope s
       set removed_at = now()
     where s.grant_id = new.grant_id and s.item_id = new.item_id
       and s.entry_id is not null and s.removed_at is null;
  end if;
  return null;
end $$;

drop trigger if exists coordination_guide_scope_after_remove on public.coordination_guide_scope;
create trigger coordination_guide_scope_after_remove after update on public.coordination_guide_scope
  for each row execute function public.coordination_guide_scope_after_remove();

create or replace function public.coordination_guide_item_in_scope(p_grant uuid, p_item uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.coordination_guide_scope s
     where s.grant_id = p_grant and s.item_id = p_item and s.entry_id is null and s.removed_at is null)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 5. coordination_guide_events
-- ---------------------------------------------------------------------------------------------------------
create table if not exists public.coordination_guide_events (
  id              uuid primary key default gen_random_uuid(),
  grant_id        uuid not null,
  host_id         uuid not null,
  guide_id        uuid not null,
  item_id         uuid not null,

  kind            text not null check (kind in (
                    'note', 'followup_done', 'contacted_professional', 'reviewed_with_host', 'waiting_on_host', 'flag_attention'
                  )),
  body            text check (body is null or char_length(btrim(body)) between 1 and 2000),

  -- Stamped by the database. The Guide cannot choose or back-date it.
  created_at      timestamptz not null default now(),
  -- The author Guide may withdraw their own; the Host may acknowledge a flag. Each is stamped once.
  withdrawn_at    timestamptz,
  acknowledged_at timestamptz,

  constraint coordination_guide_events_grant_fk
    foreign key (grant_id, host_id, guide_id) references public.coordination_guide_grants (id, host_id, guide_id) on delete cascade,
  constraint coordination_guide_events_item_fk
    foreign key (item_id, host_id) references public.coordination_items (id, host_id),
  constraint coordination_guide_events_body_required
    check (kind not in ('note', 'flag_attention') or body is not null),
  constraint coordination_guide_events_ack_only_flag
    check (acknowledged_at is null or kind = 'flag_attention')
);

create index if not exists coordination_guide_events_item_idx
  on public.coordination_guide_events (item_id, created_at);
create index if not exists coordination_guide_events_grant_idx
  on public.coordination_guide_events (grant_id, created_at);
create index if not exists coordination_guide_events_host_flag_idx
  on public.coordination_guide_events (host_id, kind) where kind = 'flag_attention';

alter table public.coordination_guide_events enable row level security;

revoke all on public.coordination_guide_events from anon, authenticated;
grant select on public.coordination_guide_events to authenticated;
grant insert (grant_id, host_id, guide_id, item_id, kind, body) on public.coordination_guide_events to authenticated;
grant update (withdrawn_at, acknowledged_at) on public.coordination_guide_events to authenticated;

-- Host: reads every event on their own items, always, including after a grant ends.
do $$ begin
  create policy "coordination guide events host read" on public.coordination_guide_events
    for select using (host_id = auth.uid());
exception when duplicate_object then null; end $$;
-- Guide: their own events, only while the grant is live.
do $$ begin
  create policy "coordination guide events guide read" on public.coordination_guide_events
    for select using (guide_id = auth.uid() and public.coordination_guide_grant_active(grant_id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide events guide insert" on public.coordination_guide_events
    for insert with check (guide_id = auth.uid() and public.coordination_guide_grant_active(grant_id, auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide events guide withdraw" on public.coordination_guide_events
    for update using (guide_id = auth.uid() and public.coordination_guide_grant_active(grant_id, auth.uid()))
    with check (guide_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "coordination guide events host acknowledge" on public.coordination_guide_events
    for update using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Insert check. SECURITY DEFINER so it can read the scope table the Guide has no access to.
create or replace function public.coordination_guide_events_check_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g record;
begin
  select * into g from public.coordination_guide_grants where id = new.grant_id;
  if not found or g.host_id <> new.host_id or g.guide_id <> new.guide_id then
    raise exception 'This record does not belong to a Guide access.';
  end if;
  if g.revoked_at is not null or g.ends_at <= now() then
    raise exception 'This Guide access has ended.';
  end if;
  if not public.coordination_guide_is_eligible(new.guide_id) then
    raise exception 'This Guide is not currently available for coordination support.';
  end if;
  if not public.coordination_guide_item_in_scope(new.grant_id, new.item_id) then
    raise exception 'That item is not included for this Guide.';
  end if;
  new.created_at := now();
  new.withdrawn_at := null;
  new.acknowledged_at := null;
  return new;
end $$;

drop trigger if exists coordination_guide_events_check_insert on public.coordination_guide_events;
create trigger coordination_guide_events_check_insert before insert on public.coordination_guide_events
  for each row execute function public.coordination_guide_events_check_insert();

-- Guard: an event is never edited. Only the author can withdraw it; only the Host can acknowledge a flag.
create or replace function public.coordination_guide_events_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id
     or new.grant_id is distinct from old.grant_id
     or new.host_id is distinct from old.host_id
     or new.guide_id is distinct from old.guide_id
     or new.item_id is distinct from old.item_id
     or new.kind is distinct from old.kind
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'A Guide record cannot be edited.';
  end if;

  if new.withdrawn_at is distinct from old.withdrawn_at then
    if old.withdrawn_at is not null then
      new.withdrawn_at := old.withdrawn_at;
    else
      if current_user in ('authenticated', 'anon') and auth.uid() is distinct from old.guide_id then
        raise exception 'Only the Guide who wrote this can withdraw it.';
      end if;
      new.withdrawn_at := now();
    end if;
  end if;

  if new.acknowledged_at is distinct from old.acknowledged_at then
    if old.acknowledged_at is not null then
      new.acknowledged_at := old.acknowledged_at;
    else
      if old.kind <> 'flag_attention' then
        raise exception 'Only a flag for the Host can be acknowledged.';
      end if;
      if current_user in ('authenticated', 'anon') and auth.uid() is distinct from old.host_id then
        raise exception 'Only the Host can acknowledge a flag.';
      end if;
      new.acknowledged_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists coordination_guide_events_guard on public.coordination_guide_events;
create trigger coordination_guide_events_guard before update on public.coordination_guide_events
  for each row execute function public.coordination_guide_events_guard();

-- ---------------------------------------------------------------------------------------------------------
-- 6. What the Guide sees: two narrow functions. The Guide has no table access to the Host's records.
--    Both return nothing (an empty list, or null) unless every condition holds, every time.
-- ---------------------------------------------------------------------------------------------------------

-- The Guide's landing list: only Hosts with a live grant. Counts only; no analytics.
create or replace function public.guide_coordination_hosts() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.coordination_guide_is_eligible(me) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'grant_id', g.id,
        'host_label', g.host_label,
        'granted_at', g.granted_at,
        'ends_at', g.ends_at,
        'item_count', (
          select count(*) from public.coordination_guide_scope s
           where s.grant_id = g.id and s.entry_id is null and s.removed_at is null),
        'waiting_on_guide_count', (
          select count(*) from public.coordination_guide_scope s
            join public.coordination_items i on i.id = s.item_id and i.host_id = g.host_id
           where s.grant_id = g.id and s.entry_id is null and s.removed_at is null
             and i.waiting_on = 'guide' and i.status <> 'closed'),
        'next_due', (
          select min(i.due_date) from public.coordination_guide_scope s
            join public.coordination_items i on i.id = s.item_id and i.host_id = g.host_id
           where s.grant_id = g.id and s.entry_id is null and s.removed_at is null and i.status <> 'closed'),
        'open_flags', (
          select count(*) from public.coordination_guide_events e
           where e.grant_id = g.id and e.kind = 'flag_attention'
             and e.acknowledged_at is null and e.withdrawn_at is null)
      ) order by g.granted_at desc)
      from public.coordination_guide_grants g
     where g.guide_id = me and g.revoked_at is null and g.ends_at > now()
       and not exists (select 1 from public.profiles hp where hp.id = g.host_id and hp.developmental_band is not null)
  ), '[]'::jsonb);
end $$;

-- The per-Host view: only the items, and only the entries, the Host chose. Third-party names on a chosen item
-- are included (decision 6). Not included, ever: source pointers, Room entries, present notes, handoff
-- payloads, recipient names or emails, links, tokens, or anything on an item that was not chosen.
create or replace function public.guide_coordination_host_view(p_grant_id uuid) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  me uuid := auth.uid();
  gr record;
  items_json jsonb;
begin
  if me is null or p_grant_id is null then
    return null;
  end if;
  select * into gr
    from public.coordination_guide_grants g
   where g.id = p_grant_id and g.guide_id = me and g.revoked_at is null and g.ends_at > now();
  if not found or not public.coordination_guide_is_eligible(me) then
    return null;
  end if;
  if exists (select 1 from public.profiles hp where hp.id = gr.host_id and hp.developmental_band is not null) then
    return null;
  end if;

  select coalesce(jsonb_agg(x.j order by x.due_date nulls last, x.created_at), '[]'::jsonb)
    into items_json
    from (
      select i.due_date, i.created_at,
        jsonb_build_object(
          'id', i.id,
          'kind', i.kind,
          'title', i.title,
          'category', i.category,
          'status', i.status,
          'waiting_on', i.waiting_on,
          'waiting_on_note', i.waiting_on_note,
          'delegation_state', i.delegation_state,
          'assigned_to_name', i.assigned_to_name,
          'assigned_to_role', i.assigned_to_role,
          'professional_name', i.professional_name,
          'professional_role', i.professional_role,
          'next_action', i.next_action,
          'due_date', i.due_date,
          'created_at', i.created_at,
          'updated_at', i.updated_at,
          'closed_at', i.closed_at,
          'related_decision_title', (
            select d.title from public.coordination_items d
             where d.id = i.related_decision_id and d.host_id = i.host_id
               and exists (
                 select 1 from public.coordination_guide_scope ds
                  where ds.grant_id = gr.id and ds.item_id = d.id and ds.entry_id is null and ds.removed_at is null)),
          'entries', (
            select coalesce(jsonb_agg(
                     jsonb_build_object(
                       'id', e.id,
                       'entry_type', e.entry_type,
                       'source_kind', e.source_kind,
                       'occurred_at', e.occurred_at,
                       'withdrawn', e.withdrawn_at is not null,
                       'withdrawn_at', e.withdrawn_at,
                       'excerpt', case when e.withdrawn_at is null then e.excerpt else null end,
                       'host_note', case when e.withdrawn_at is null then e.host_note else null end
                     ) order by e.occurred_at, e.created_at), '[]'::jsonb)
              from public.coordination_guide_scope se
              join public.coordination_entries e on e.id = se.entry_id
             where se.grant_id = gr.id and se.item_id = i.id and se.entry_id is not null and se.removed_at is null
               and e.item_id = i.id and e.host_id = gr.host_id and e.source_kind <> 'room_message'),
          'handoffs', (
            select coalesce(jsonb_agg(
                     jsonb_build_object(
                       'recipient_role', cs.recipient_role,
                       'recipient_role_label', cs.recipient_role_label,
                       'authorized_at', cs.authorized_at,
                       'expires_at', cs.expires_at,
                       'status', case
                                   when cs.revoked_at is not null then 'revoked'
                                   when cs.expires_at <= now() then 'expired'
                                   else 'active' end,
                       'viewed', cs.first_viewed_at is not null
                     ) order by cs.authorized_at), '[]'::jsonb)
              from public.coordination_shares cs
             where cs.item_id = i.id and cs.host_id = gr.host_id),
          'events', (
            select coalesce(jsonb_agg(
                     jsonb_build_object(
                       'id', ev.id,
                       'kind', ev.kind,
                       'body', ev.body,
                       'created_at', ev.created_at,
                       'withdrawn_at', ev.withdrawn_at,
                       'acknowledged_at', ev.acknowledged_at
                     ) order by ev.created_at), '[]'::jsonb)
              from public.coordination_guide_events ev
             where ev.grant_id = gr.id and ev.item_id = i.id)
        ) as j
        from public.coordination_guide_scope s
        join public.coordination_items i on i.id = s.item_id and i.host_id = gr.host_id
       where s.grant_id = gr.id and s.entry_id is null and s.removed_at is null
    ) x;

  return jsonb_build_object(
    'grant', jsonb_build_object('id', gr.id, 'host_label', gr.host_label, 'granted_at', gr.granted_at, 'ends_at', gr.ends_at),
    'items', items_json
  );
end $$;

-- Who may run the functions: signed-in users only. Anonymous visitors get nothing.
revoke all on function public.coordination_guide_is_eligible(uuid) from public, anon, authenticated;
grant execute on function public.coordination_guide_is_eligible(uuid) to authenticated;
revoke all on function public.coordination_guide_grant_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.coordination_guide_grant_active(uuid, uuid) to authenticated;
revoke all on function public.coordination_guide_item_in_scope(uuid, uuid) from public, anon, authenticated;
grant execute on function public.coordination_guide_item_in_scope(uuid, uuid) to authenticated;
revoke all on function public.list_eligible_coordination_guides() from public, anon, authenticated;
grant execute on function public.list_eligible_coordination_guides() to authenticated;
revoke all on function public.guide_coordination_hosts() from public, anon, authenticated;
grant execute on function public.guide_coordination_hosts() to authenticated;
revoke all on function public.guide_coordination_host_view(uuid) from public, anon, authenticated;
grant execute on function public.guide_coordination_host_view(uuid) to authenticated;

comment on table public.coordination_guide_grants is
  'A Host''s time-limited, revocable authorization for one eligible Guide to see the coordination items the Host chose (Decision 0011). Created by the Host; the database verifies the Guide and stamps the dates; never edited, never deleted; revoked_at is stamped once and never undone. No admin policy.';
comment on table public.coordination_guide_scope is
  'What the Host included for a Guide: a row without an entry is an item, a row with an entry is that entry. Host-only table; the Guide never reads it. Removing an item removes its entries. A Shared Room entry or a withdrawn entry can never be included.';
comment on table public.coordination_guide_events is
  'Guide-authored notes and follow-up marks. Append-only and visibly the Guide''s: never part of coordination_entries, never the Host''s words, never part of a Phase 3 share. The author Guide may withdraw; the Host may acknowledge a flag; nothing is deleted.';
comment on column public.coordination_guide_grants.valid_days is
  'The Host-chosen lifetime, 1 to 90 days. ends_at is computed by the database. There is no extension: to continue, the Host authorizes a new grant.';
