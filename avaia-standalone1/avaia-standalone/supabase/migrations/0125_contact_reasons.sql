-- 0125_contact_reasons.sql
--
-- Two new, distinct reasons for contacting AVAIA, so the form can record WHY a visitor came from the
-- Families & Professional Teams page instead of filing everyone under "general" or "other":
--
--   professional_referral   an attorney, accountant, advisor, hospice or other professional contacting AVAIA about
--                           a client or family they support
--   organization            an employer, organization or professional firm contacting AVAIA about its people,
--                           clients or participants
--
-- Purely additive: the existing check on contact_submissions.reason is widened from six values to eight. No
-- column is added, no row is changed, and the table's posture is unchanged (service-role only, no policies).
--
-- Safe to run more than once. Whatever the old check was named, any check on this table that mentions `reason` is
-- replaced by the single widened one.

do $$
declare
  c record;
begin
  for c in
    select k.conname
      from pg_constraint k
     where k.conrelid = 'public.contact_submissions'::regclass
       and k.contype = 'c'
       and pg_get_constraintdef(k.oid) like '%reason%'
  loop
    execute format('alter table public.contact_submissions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.contact_submissions
  add constraint contact_submissions_reason_check
    check (reason in (
      'general', 'guiding', 'workshops', 'schools', 'certification', 'other',
      'professional_referral', 'organization'
    ));
