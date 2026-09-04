-- AVAIA Youth Defying Grief -- publish. Dorian has explicitly approved
-- publication of the existing Youth Defying Grief curriculum (experience
-- "The Things We Lose After the Loss — Youth", id
-- c271efca-7872-481e-88b8-d401e52aaedb). This was deliberately left in
-- 'draft' by 0040's own header ("a decision for Dorian, not an engineering
-- default") -- that decision has now been made. Nothing about the content
-- changes here: no module rewritten, no developmental adaptation touched,
-- no consent/assent/privacy language altered. This is the exact same
-- publish-only mechanism 0036 already used for the Adult experience --
-- flips status on the parent experiences row and every one of its
-- experience_sections rows, which is what the Guide-read RLS policy
-- (0031_experience_toolkit_authorization.sql) actually requires on BOTH
-- before a real (non-admin) Guide can see this content through the
-- Toolkit at all.
update public.experiences
set status = 'published', updated_at = now()
where id = 'c271efca-7872-481e-88b8-d401e52aaedb'
  and status = 'draft';

update public.experience_sections
set status = 'published', updated_at = now()
where experience_id = 'c271efca-7872-481e-88b8-d401e52aaedb'
  and status = 'draft';
