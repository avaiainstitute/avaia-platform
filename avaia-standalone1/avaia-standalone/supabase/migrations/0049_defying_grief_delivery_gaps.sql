-- AVAIA Defying Grief -- close two narrow, real delivery gaps found during a
-- live facilitator-readiness audit ("could Dorian walk into a room tomorrow
-- with only what's already here?"). Both are content-only additions to the
-- already-published Adult Master Curriculum (experience_id
-- 52b5b562-e1b4-4238-88e7-746fb56e1083) -- no new section, no schema
-- change, no rewording of anything that already exists. Neither touches the
-- Youth curriculum (experience_id c271efca-7872-481e-88b8-d401e52aaedb),
-- which stays in its existing 'draft' status -- that is a genuine,
-- already-recorded product decision (see 0040's own header), not something
-- this migration should change.
--
-- Gap 1: the Facilitator Delivery Guide (published, id
-- 0634dd3d-2c41-4afc-a783-c300488441a1) already tells a facilitator how to
-- run every other part of the room -- private AVAIA time, capacity/pause,
-- bringing the room back -- but said nothing about AVAIA's physical
-- Chemistry of Virtue materials (the printed table/cards), even though
-- "What Is Still Here?" (Module 8's own activity row) already invokes
-- Chemistry conceptually. A facilitator with physical materials in the room
-- had no instruction for using them or bridging back to the digital
-- Chemistry/Signature a participant might already have. Fixed by appending
-- one more topic sentence in the exact same style as the guide's existing
-- ones (a colon-led clause, not a new field) -- deliberately silent on
-- which physical format Dorian actually uses (cards, a poster, a printed
-- table), since this repo has no record of that and inventing one would be
-- a fabricated instruction, not a real one.
--
-- Gap 2: the Take-Home Record (published, id
-- 5d41789f-1314-463b-8f1f-6ddea7eacf15) is a genuinely complete private
-- worksheet, but nothing in it, or anywhere else printable for this
-- Experience, told a live attendee how to connect what they just wrote to
-- their own ongoing AVAIA Workbook/Chemistry/Signature -- the session was a
-- real dead end for continuity. Fixed by appending one more field in the
-- Take-Home Record's own established ALL-CAPS-LABEL -- text convention
-- (see lib/experience-sections.ts's PROMPT_FIELD_PATTERN, which both print
-- routes already parse this body with). Deliberately does not hardcode a
-- production URL -- this repository has no canonical domain on record
-- anywhere (checked); the field instead tells the facilitator to hand over
-- today's actual sign-in link/QR code, which is exactly the kind of
-- session-specific detail that belongs with the person running the room,
-- not baked into shared curriculum content.
update public.experience_sections
set body = body || ' Using physical Chemistry of Virtue materials: if a printed table, element cards, or similar physical materials are present in the room, this is where they belong -- during "What Is Still Here?", let participants handle and browse them at their own pace, then invite (never require) them to log anything that felt true afterward, privately, in their own AVAIA account -- the same Chemistry of Virtue table and Virtue Signature that live there permanently, once they have one.'
where id = '0634dd3d-2c41-4afc-a783-c300488441a1';

update public.experience_sections
set body = body || ' HOW TO CONTINUE — This Take-Home Record is yours to keep either way. If you would like it to keep going as your own ongoing AVAIA Journey -- saved privately in your own Workbook, with the full Chemistry of Virtue and your own Virtue Signature -- ask your Guide or facilitator for today''s sign-in link or QR code. The account is yours alone; nothing you wrote above is seen by AVAIA, your Guide, or any organization unless you choose to bring it into a conversation yourself.'
where id = '5d41789f-1314-463b-8f1f-6ddea7eacf15';
