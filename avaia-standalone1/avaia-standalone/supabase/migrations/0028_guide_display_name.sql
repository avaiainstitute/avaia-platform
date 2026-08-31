-- Guide display name -- the narrow identity prerequisite for Phase E.3.
-- Purely additive: one nullable column, two narrow SECURITY DEFINER
-- functions, zero RLS policy changes on profiles or any other table.
--
-- ============================================================================
-- IMPORTANT -- THIS IS NOT A GENERAL PROFILE/DISPLAY-NAME SYSTEM.
--
-- guide_display_name exists for exactly one purpose: giving a Host a
-- meaningful human-readable identity for an eligible Certified Guide,
-- instead of a raw email address or an anonymous id. It is not a public
-- Guide directory, not a username, not a legal-name requirement, and not
-- an account-wide AVAIA display-name architecture. It is admin-managed
-- only in this phase -- no Guide self-service editing exists.
--
-- IMPORTANT -- WHY TWO SECURITY DEFINER FUNCTIONS INSTEAD OF NEW RLS ON
-- PROFILES.
--
-- profiles has always been strictly self-only (see its three "self-only"
-- policies) -- no admin-all policy exists there, unlike almost every other
-- table in this schema, and this migration deliberately does not add one.
-- A general admin-all policy on profiles would make every column --
-- including role and membership_status -- writable through any future
-- admin UI via the ordinary RLS-bound client, not only through this one
-- narrow field. Two small SECURITY DEFINER functions instead: one lets
-- any authenticated Host look up (id, guide_display_name) for currently
-- eligible Guides only, or a specific Guide's name by id; the other lets
-- an admin set the field, with the admin check performed inside the
-- function itself -- the same exists()-role-check every "... admin all"
-- policy elsewhere in this schema already uses, just expressed as a
-- function guard instead of a table policy because this is one column,
-- not a whole table. Both functions touch guide_display_name only --
-- never email, role, certification evidence, evaluator notes, or any
-- other profile/account data.
-- ============================================================================

alter table public.profiles
  add column if not exists guide_display_name text;

-- Read: any authenticated user (a Host, selecting a Guide to invite) may
-- see the small set of currently eligible, currently named Guides --
-- exactly the two columns needed for a selection list. "Eligible" is
-- computed fresh here, not cached or duplicated: an active
-- guide_certifications standing, an authorized guide_platform_
-- authorizations row for 'guided_journey_facilitation' specifically
-- (Toolkit authorization is not sufficient), and a non-empty
-- guide_display_name. A Guide missing any of the three is simply absent
-- from the result -- never falls back to email.
create or replace function public.list_eligible_guided_journey_guides()
returns table (guide_id uuid, guide_display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.guide_display_name
  from public.profiles p
  where p.guide_display_name is not null and btrim(p.guide_display_name) <> ''
    and exists (
      select 1 from public.guide_certifications gc
      where gc.host_id = p.id and gc.standing = 'active'
    )
    and exists (
      select 1 from public.guide_platform_authorizations gpa
      where gpa.host_id = p.id
        and gpa.capability = 'guided_journey_facilitation'
        and gpa.status = 'authorized'
    );
$$;

grant execute on function public.list_eligible_guided_journey_guides() to authenticated;

-- Read: resolves one specific Guide's display name by id, regardless of
-- current eligibility -- used to show "who is currently invited" on a
-- Host's own guide_journey_access row even if that Guide's authorization
-- later changes. Returns only the name, nothing else from profiles.
create or replace function public.get_guide_display_name(p_guide_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select guide_display_name from public.profiles where id = p_guide_id;
$$;

grant execute on function public.get_guide_display_name(uuid) to authenticated;

-- Write: admin-only, enforced inside the function. Sets (or clears, if
-- blank) guide_display_name for one account and touches nothing else.
create or replace function public.set_guide_display_name(p_host_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an AVAIA admin may set a Guide display name.';
  end if;
  update public.profiles
  set guide_display_name = nullif(btrim(p_name), '')
  where id = p_host_id;
end;
$$;

grant execute on function public.set_guide_display_name(uuid, text) to authenticated;
