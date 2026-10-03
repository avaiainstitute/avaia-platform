-- SAFETY TEST for migration 0112. Changes NOTHING: the whole block ends with a
-- deliberate error, which makes the database roll back everything it did.
--
-- It pretends to be a signed-in browser session for one real account (kidathart@gmail.com),
-- then tries two things:
--   1. to change that account's own role  -> should be REFUSED once 0112 is installed
--   2. an ordinary edit to its own profile -> should still be ALLOWED
--
-- Read the message at the bottom (it appears as an "error"; that is expected):
--   Before 0112:  role change blocked: false   (the hole is open)
--   After  0112:  role change blocked: true, ordinary edit allowed: true   (fixed)
do $$
declare
  uid uuid := (select id from auth.users where email = 'kidathart@gmail.com');
  blocked boolean := false;
  allowed boolean := false;
  matched integer := 0;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    update public.profiles set role = case when role = 'member' then 'admin' else 'member' end where id = uid;
    get diagnostics matched = row_count;
  exception when others then
    blocked := true;
  end;

  begin
    update public.profiles set marketing_consent = marketing_consent where id = uid;
    allowed := true;
  exception when others then
    allowed := false;
  end;

  reset role;
  raise exception 'TEST RESULT -- role change blocked: %, ordinary edit allowed: %, rows the role attempt could see: %. (This message is expected; nothing was changed.)',
    blocked, allowed, matched;
end $$;
