-- AVAIA Youth Defying Grief -- Guardian Consent + Youth Privacy & Agency
-- (governing decision), curriculum content updates. The boundary row this
-- migration updates was deliberately left as an open question in
-- 0040_youth_defying_grief_master_curriculum.sql ("Guardian, consent, and
-- institutional delivery -- open, not answered here"). That question is
-- now answered by the governing decision; this migration updates the
-- curriculum content to reflect it, and unblocks the group/workshop
-- format_variant row that was marked "not yet delivery-ready" pending
-- exactly this. Every row here is addressed by its own stable id, matching
-- 0033/0036's own established pattern for updating specific rows without
-- disturbing the rest of the curriculum.

-- Boundary 3: was "Guardian, consent, and institutional delivery -- open,
-- not answered here." Now states the actual governing model.
update public.experience_sections
set title = $$Guardian consent, Youth ownership, and Youth agency$$,
    body = $$The guardian gives permission for participation. The Youth Host retains ownership of their story and agency over what they choose to share. Guardian consent (a real, named, recorded consent -- not only a self-attestation) authorizes a Youth Host's participation. It does NOT automatically grant access to their private conversations, reflections, Workbook content, Guide's Record, or other private AVAIA content -- the same principle AVAIA already holds for adults: payment gives access, not authority. For Youth, guardian permission allows participation; it does not transfer ownership of the Youth Host's story. The Youth Host also retains agency over what they voluntarily choose to share -- with their Guide, with a parent or guardian, in a group, or not at all. Participation is never treated as consent to disclosure, and private reflection is always a legitimate, complete form of participation on its own.$$,
    updated_at = now()
where id = '82d65f6d-d339-4088-b4c5-23c9a364927b'
returning id, title;

-- New boundary 5: group/workshop privacy -- what AVAIA can and cannot
-- promise once more than one participant is in the room.
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 5,
  $$Group and workshop privacy$$,
  $$AVAIA can control what AVAIA, the Guide, a school, an organization, and a guardian do with information. AVAIA cannot promise that another participant in a live group will keep something confidential -- that promise is not AVAIA's to make. Group materials and Guide instructions must keep three things distinct: private AVAIA content (a participant's own IAP/CAT/InnerCompass conversation, never seen by anyone else in the room); something a participant voluntarily brings into the shared room themselves; and information spoken aloud in front of other participants, which AVAIA cannot guarantee stays confidential once said. The Guide protects the Table and sets clear participation boundaries at the start of a group session, while always preserving a participant's choice not to disclose -- private reflection is a complete way to participate in a group activity, not a lesser one.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- New boundary 6: school/organization/sponsor boundary.
insert into public.experience_sections (experience_id, section_type, position, title, body, status)
select e.id, 'boundary', 6,
  $$School, organization, and sponsor boundary$$,
  $$A school, organization, program sponsor, or funder may arrange or pay for a Youth Host's access to Youth Defying Grief without receiving that Youth Host's private content. If aggregate or program-level information is ever provided to a sponsoring party, it must never become a disguised way of exposing an identifiable Youth Host's private story. AVAIA does not build school dashboards, parent dashboards, sponsor reports, or administrative access to private Youth conversations merely because that party facilitated or paid for participation -- no such surface exists in this platform, and none is created by arranging or sponsoring a Youth Host's participation.$$,
  'draft'
from public.experiences e where e.title = 'The Things We Lose After the Loss — Youth'
returning id, title;

-- Format variant: was "Group workshop presentation (not yet delivery-
-- ready)." Guardian consent and group-privacy content now exist, so the
-- format is real -- what stays true is that there is no batch-
-- registration UI; a Guide registers each attendee individually.
update public.experience_sections
set title = $$Group / workshop session$$,
    body = $$Shared experience: Modules 1 through 6, presented to a group of young participants together by a certified Guide, using the Master Curriculum content and its Facilitator/Participant print materials -- closing with a private individual reflection for each attendee. Guardian consent and the Youth participation information are collected per attendee through the Guide Toolkit's Youth Defying Grief entry (context: Group / workshop), each producing its own guardian_consents record -- there is no batch-registration step; a Guide runs this once per person in the room. Private AVAIA layer: each attendee may open their own individual Youth IAP afterward, exactly as in the individual format -- never shared, never visible to the rest of the group. Take-home: Your Own Ripple, individually. Group privacy: see the Protected Boundaries above -- AVAIA cannot promise participant-to-participant confidentiality, and no participant is ever required to disclose aloud to take part.$$,
    status = 'draft',
    updated_at = now()
where id = '566043e6-aff3-4373-b3e7-d19161e4bae7'
returning id, title;

-- Facilitator Delivery Guide: adds Group/Workshop delivery guidance and
-- the consent-scope distinction, alongside everything already there.
update public.experience_sections
set body = $$Guide discipline: leave every session knowing more about what deserves to be seen in this young person, not believing you know more about who they are. A referral or a completed module does not make a young person a problem to solve -- it makes them a person you can now understand a little more of. If you find yourself thinking "now I know what's wrong with this kid," stop and return to: "now I can see more of what this person has been carrying." Communication, not diagnosis: a participant does not need a diagnosis of ADHD, autism, dyslexia, anxiety, or anything else before you accommodate how they communicate -- fragments, tangents, silence, needing to move, very short or very long answers. Different is not deficient; a young person struggling to say something doesn't by itself tell you what the struggle means. What to preserve at every band: the shared/private split, that disclosure is never required, that Secondary Losses and Audacity are recognized rather than diagnosed, and that the participant -- not a parent, not the Guide -- owns their own private conversation and record. What to adapt: pacing, how concrete or abstract your language is, how much you rely on drawing or writing versus talking, and how long you spend on any one module. A younger participant often needs one idea at a time; an older one may want to move faster or go deeper than expected -- follow the actual person in front of you, not their age on paper. Presence of a parent or guardian: if a parent or guardian is present for any part of delivery, they observe the shared-room portions only -- they are never inside a participant's private reflection, private AVAIA conversation, or private written record, and they are never the one who decides what a participant's answers mean. Transition to independence: some participants, especially older ones, may be sitting inside a real tension about how much independence they're ready for, sometimes held alongside their own parent's fear of letting go. Don't resolve that tension for them, and don't let a parent become the decision-maker inside the participant's own conversation. Guardian consent and Youth assent are two separate things: guardian consent (a name, an email, and a confirmation you collected before beginning) authorizes participation; separately, you must confirm you communicated the age-appropriate participation information to the Youth Host themselves -- both are required before a session starts, whichever context you're delivering in (individual, group/workshop, or a school/organization-sponsored session). Group/workshop delivery specifically: register each attendee's consent individually through the Youth Defying Grief entry before the session begins -- there is no batch step. During the group, keep private AVAIA content, something a participant voluntarily brings into the room, and something spoken aloud in front of others clearly distinct in your own instructions to the group -- never promise confidentiality you cannot guarantee, and always offer a way to participate privately (writing, drawing, quiet reflection) instead of speaking aloud. A school or organization arranging a session does not get access to any attendee's private content, regardless of who paid. Not-therapy boundary: if a genuine safety concern appears, step out of the curriculum entirely and follow AVAIA's youth safety guidance -- the same standard as any other AVAIA Youth conversation.$$,
    updated_at = now()
where id = 'd89049a2-899a-47ea-b265-e6163005b99a'
returning id, title;
