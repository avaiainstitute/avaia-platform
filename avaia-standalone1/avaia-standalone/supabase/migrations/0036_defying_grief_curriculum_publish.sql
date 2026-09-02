-- Closes two narrow gaps found in the "AVAIA — Close the Yellows"
-- completion sweep (2026-09), both confirmed against live production data
-- before this migration was written.
--
-- 1. Every experience_sections row for "The Things We Lose After the Loss"
--    (all 11 Master Curriculum modules, the Facilitator Delivery Guide, the
--    Participant Guide, activities, the Take-Home Record, and 6 of 7
--    format variants) has been stuck at status='draft' since it was first
--    authored across migrations 0021/0030/0032/0033 -- no migration ever
--    published a single section row, only the parent experiences row
--    (0031). The Guide-read RLS policy on experience_sections
--    (0031_experience_toolkit_authorization.sql) requires status='published'
--    on BOTH the section and its parent, so a real (non-admin) Guide
--    visiting the Toolkit's Defying Grief curriculum today sees an empty
--    detail page -- this went unnoticed because the admin draft-preview
--    uses the unfiltered "admin all" RLS policy instead. Confirmed via a
--    live query (44 of 44 rows draft) before writing this fix.
--
--    The one deliberate exception: the "Youth adaptation" format variant
--    (0021_experience_sections_pilot.sql) is explicitly a separate,
--    safeguarded architecture, out of scope for this pass -- it stays
--    draft. Every other row for this Experience is adult-facing curriculum
--    content and is published here.
--
-- 2. The "Half-day workshop" format variant mapped only to Modules 1-8,
--    never reaching Agency (Modules 9-11) or the program's own closing
--    line -- inconsistent with both the shorter 60-90 minute workshop
--    (which reaches a shortened Module 10) and the longer 2-day/3-day
--    retreats (which both reach Module 11's closing). This corrects the
--    format's own stated module range to match its actual length; it does
--    not add any new curriculum content -- Modules 9-11 already exist,
--    fully authored, in this same Experience.

update public.experience_sections es
set status = 'published', updated_at = now()
from public.experiences e
where es.experience_id = e.id
  and e.title = 'The Things We Lose After the Loss'
  and es.status = 'draft'
  and not (es.section_type = 'format_variant' and es.title = $$Youth adaptation$$)
returning es.id, es.section_type, es.title, es.status;

update public.experience_sections es
set body = $$Shared experience: Modules 1 through 11, in full, closing with Module 11's anchor (We don't move on, we move with). Private AVAIA layer: IAP encouraged during the session; CAT can continue afterward. Take-home: expanded map plus a continuity question.$$,
    updated_at = now()
from public.experiences e
where es.experience_id = e.id and e.title = 'The Things We Lose After the Loss'
  and es.section_type = 'format_variant' and es.title = $$Half-day workshop$$
returning es.id, es.title;
