-- 0112_protect_profile_authority.sql
--
-- Closes a privilege-escalation hole. Every account has a profile row whose
-- "role" says member / guide / admin, and the "profiles are self-only
-- (update)" policy lets a signed-in person edit their own row -- without
-- limiting WHICH columns. Both `anon` and `authenticated` hold UPDATE on the
-- role column, and every visitor who starts a Journey is a signed-in
-- (anonymous) user, so anyone could set their own role to 'admin' from the
-- browser and open the admin pages.
--
-- This adds one protective rule (a trigger) on public.profiles:
--   * A request that comes straight from a person's browser (it runs as the
--     database role `authenticated` or `anon`) may not change role,
--     guide_certified_at, guide_display_name, or membership_status.
--   * A profile row created straight from a browser is forced to the plain
--     'member' role with no Guide fields.
-- Everything else a person may edit on their own profile (consent, age,
-- marketing choices, developmental band) is unchanged.
--
-- Who still passes: the SQL editor (runs as postgres), the server's service
-- key (runs as service_role), and the database's own functions that run with
-- their owner's rights (the signup function that creates profiles, and the
-- admin-only set_guide_display_name). Nothing is changed in any existing row.
-- Safe to run more than once. To undo: drop trigger profiles_protect_authority
-- on public.profiles;

create or replace function public.profiles_protect_authority()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- Only a request made directly from a browser session runs as one of these.
  -- The service key, the SQL editor, and security-definer functions do not.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'member';
    new.guide_certified_at := null;
    new.guide_display_name := null;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.guide_certified_at is distinct from old.guide_certified_at
     or new.guide_display_name is distinct from old.guide_display_name
     or new.membership_status is distinct from old.membership_status then
    raise exception 'These profile fields can only be changed by AVAIA, not from a signed-in browser session.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_authority on public.profiles;
create trigger profiles_protect_authority
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_authority();

comment on function public.profiles_protect_authority() is
  'Stops a browser session from granting itself authority by editing its own profile (role, guide fields, legacy membership_status). Service key, SQL editor, and definer functions are unaffected.';

-- Verification (read-only): the rule is installed and enabled.
select tgname as rule_name, tgenabled as enabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_protect_authority';
