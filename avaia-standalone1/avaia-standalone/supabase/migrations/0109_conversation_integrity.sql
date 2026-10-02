-- The AVAIA Conversation Integrity & Boundary Oversight Agent's data
-- layer. Purely additive: three new tables. Audited first (see the final
-- report for the full audit):
--
--  - A real crisis detection/prefilter already exists and is NOT
--    duplicated here: lib/engine/anthropic.ts's detectCrisis() (a
--    conservative, recall-favoring keyword pre-check) already runs on
--    every Host turn in app/api/conversation/route.ts, logging to the
--    existing crisis_events table (host_id, conversation_id, created_at
--    only -- no content, by design, per that table's own comment). This
--    migration does not touch crisis_events and does not re-implement
--    crisis detection; it adds a SAFETY_PROTOCOL check (see
--    lib/conversation-integrity.ts) that correlates an existing
--    crisis_events row with whether the very next AI/Guide-role reply
--    actually contained crisis-protocol language -- verifying the
--    established pathway was followed, never re-deciding whether a
--    crisis existed.
--  - No prompt-version or model-version table exists anywhere (only a
--    single AVAIA_MODEL string constant in lib/engine/prompts.ts, never
--    persisted per-message). conversation_integrity_flags.model_snapshot
--    below is a plain text snapshot of that constant's value at
--    detection time -- the most truthful thing available -- not a
--    foreign key into an invented prompt_versions table.
--  - No admin surface has ever read public.conversations or
--    public.messages before this build.
--
-- GOVERNING ROLE enforced structurally: this agent flags possible
-- boundary issues in AVAIA's own system/Guide behavior for human
-- disposition -- it never stores a diagnostic conclusion about the Host.
-- flag_category and avaia_rule_implicated describe the AVAIA rule a
-- turn may be inconsistent with; nothing on this table lets automation
-- write "Host is unstable" or any other character/psychological
-- judgment, about the Host or the Guide. human_disposition is only ever
-- populated by a human reviewer -- a flag by itself is never a finding.
--
-- PRIVACY / MINIMUM DATA: no column here duplicates conversation content.
-- detection_basis is a short description of what triggered the flag (e.g.
-- "keyword pattern: diagnostic-language prefilter"), never the message
-- text itself; message_id is a pointer back into the existing, already
-- access-controlled messages table for an authorized reviewer to open
-- directly, not a copy.

create table if not exists public.conversation_integrity_flags (
  id                     uuid primary key default gen_random_uuid(),
  conversation_id        uuid references public.conversations (id) on delete cascade,
  -- The Host who owns the conversation (conversations.host_id) -- kept
  -- here, not just joinable, so a flag's RLS insert-check and later
  -- admin queries don't require trusting a join at insert time. Mirrors
  -- crisis_events' own host_id column exactly.
  host_id                uuid references auth.users (id) on delete set null,
  message_id             uuid references public.messages (id) on delete set null,
  stage                  text check (stage in ('iap', 'cat', 'innercompass')),
  -- Free text, deliberately NOT re-declaring conversations.program's own
  -- check constraint here -- this table reads that value, it doesn't own
  -- it, and duplicating the check risks silently drifting out of sync if
  -- that table's own program list changes.
  program                text,
  involved_role          text check (involved_role in ('host', 'guide')),
  flag_category          text not null check (flag_category in (
                            'DIAGNOSTIC_OVERREACH', 'PRESCRIPTION', 'SCOPE_OVERREACH',
                            'CAPACITY_OR_CONSENT', 'FORCED_DISCLOSURE', 'HOST_OWNERSHIP',
                            'RECOGNITION_OVERREACH', 'EMOTIONAL_INTENSITY_MISUSE', 'PRIVACY_SCOPE',
                            'YOUTH_SAFEGUARD', 'SAFETY_PROTOCOL', 'IMPROPER_CARRY_FORWARD',
                            'SYSTEM_PROMPT_BEHAVIOR', 'POLICY_REQUIRED', 'LEGAL_REVIEW_REQUIRED'
                          )),
  severity               text not null check (severity in (
                            'INFORMATIONAL', 'REVIEW', 'HIGH_PRIORITY', 'POLICY_REQUIRED',
                            'LEGAL_REVIEW_REQUIRED'
                          )),
  avaia_rule_implicated  text not null,
  detection_basis        text not null,
  model_snapshot         text,
  review_required        boolean not null default true,
  review_status          text not null default 'open' check (review_status in ('open', 'in_review',ƒœ™\ÛÛ™Y	ÊJKˆ[X[—Ù\ÜÜÚ][Ûˆ^ÚXÚÈ
[X[—Ù\ÜÜÚ][Ûˆ[ˆ
ˆ	Ó“×Õ’SÓUSÓ‰Ë	ĞÓĞPÒS‘×ÓÔ—ĞÓÔ”‘PÕSÓ‰Ë	ÔÖTÕSWÔ“ÓTÑ’V	Ëˆ	ÑÕRQWÔ‘U’QU×Ô‘TURT‘Q	Ë	ĞPĞÑTÔ×ÓÔ—Ô’UPÖWĞPÕSÓ‰Ë	ÔĞQ‘UWÑTĞĞSUSÓ‰Ëˆ	ÔÓPÖWÔ‘TURT‘Q	Ë	ÓQĞSÔ‘U’QU×Ô‘TURT‘Q	Âˆ
JKˆÛÜœ™Xİ]™WØXİ[Ûˆ^ˆ™]šY]ÙYØH]ZY™Y™\™[˜Ù\È]]\Ù\œÈ
Y
HÛˆ[]HÙ][ˆ™]šY]ÙYØ][Y\İ[\‹ˆÜ™X]YØ][Y\İ[\ˆ›İ[Y˜][›İÊ
BŠNÂ‚˜Ü™X]H[™^Yˆ›İ^\İÈÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜ×ØÛÛ™\œØ][Û—ÚYˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÈ
ÛÛ™\œØ][Û—ÚYÜ™X]YØ]\ØÊNÂ˜Ü™X]H[™^Yˆ›İ^\İÈÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜ×Ü™]šY]×ÚYˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÈ
™]šY]×Üİ]\ËÙ]™\š]KÜ™X]YØ]\ØÊNÂ‚˜[\ˆX›HX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÈ[˜X›H›İÈ]™[ÙXİ\š]NÂ‹KH[œÙ\[Û›HÙ[ˆÛXŞKY[XØ[[ˆÚ\HÈÜš\Ú\×Ù]™[ÉÈİÛ‚‹KH˜Üš\Ú\È[œÙ\Ù[ˆˆÛXŞHKH]ÈH]™HÛÛ™\œØ][Ûˆ›İ]H™XÛÜ™‹KHH›YÈ\Ú[™ÈHÜİ	ÜÈİÛˆÙ\ÜÚ[ÛˆÛY[
HØ[YHÛY[]‹KH[™XYH[œÙ\È[ÈÜš\Ú\×Ù]™[ÈÙ^JHÚ]İ][ˆYZ[ˆÛY[[‚‹KHHİİ™X[Z[™È]ˆ[X™\˜][H“ÈÙ[‹\Ù[XİÛXŞNˆ\È\Â‹KHİ™\œÚYÚ]HX›İ]HÛÛ™\œØ][Û‰ÜÈ™Z]š[Ü‹›İHÜİ	ÜÈİÛ‚‹KH™XÛÜ™[™^ÜÚ[™È˜]È›YÜÈÈH\œÛÛˆHÛÛ™\œØ][Ûˆ\ÈX›İ]‹KH\È›İÚ]\ÈYÙ[\È›Üˆ
ÙYH][HKHHİZYKY˜XÚ[™Èİ\™˜XÙB‹KH\ÈZ[Ù\\˜][KÙ\™\‹\ÚYK™]™\ˆHÜ˜[[™ÈX›K[]™[™XY
K‚™È		™YÚ[‚ˆÜ™X]HÛXŞH˜ÛÛ™\œØ][Ûˆ[YÜš]H[œÙ\Ù[ˆˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÂˆ›Üˆ[œÙ\Ú]ÚXÚÈ
]]ZY

HHÜİÚY
NÂ™^Ù\[ÛˆÚ[ˆ\XØ]WÛØš™Xİ[ˆ[È[™		Â™È		™YÚ[‚ˆÜ™X]HÛXŞH˜ÛÛ™\œØ][Ûˆ[YÜš]HYZ[ˆ[ˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÂˆ›Üˆ[ˆ\Ú[™È
^\İÈ
Ù[XİHœ›ÛHX›XËœ›Ùš[\ÈÚ\™HšYH]]ZY

H[™œ›ÛHH	ØYZ[‰ÊJBˆÚ]ÚXÚÈ
^\İÈ
Ù[XİHœ›ÛHX›XËœ›Ùš[\ÈÚ\™HšYH]]ZY

H[™œ›ÛHH	ØYZ[‰ÊJNÂ™^Ù\[ÛˆÚ[ˆ\XØ]WÛØš™Xİ[ˆ[È[™		Â‚‹KHKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKB‹KHÛÛ™\œØ][Û—Ú[YÜš]WÜØØ[œÈKHÛ™H›İÈ\ˆÛÛ™\œØ][Û‹HØØ[‚‹KHİ\œÛÜˆHÜİXÛÛ™\œØ][Ûˆ[YÜš]HØØ[ˆ\Ù\ÈÛÈ]™]™\ˆ™K\ØØ[œÂ‹KHHØ[YHY\ÜØYÙ\ÈÚXÙKˆ\™[HÜ\˜][Û˜[›ÛÚÚÙY\[™ÈKHYZ[‹Â‹KHÙ\šXÙK\›ÛHÛ›KØ[YH™\›Ë\Ù[‹\ÛXŞHÜİ\™H\Â‹KHİZYWØØ[™Y]WÚ\İÜH[™›ÙÜ˜[WØ]]Üš^˜][Û—Ú\İÜK‚‹KHKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKB˜Ü™X]HX›HYˆ›İ^\İÈX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜØØ[œÈ
ˆÛÛ™\œØ][Û—ÚY]ZYš[X\HÙ^H™Y™\™[˜Ù\ÈX›XË˜ÛÛ™\œØ][ÛœÈ
Y
HÛˆ[]HØ\ØØYKˆ\İÜØØ[›™YÛY\ÜØYÙWÚY]ZY™Y™\™[˜Ù\ÈX›XË›Y\ÜØYÙ\È
Y
HÛˆ[]HÙ][ˆ\İÜØØ[›™YØ][Y\İ[\ˆ›İ[Y˜][›İÊ
BŠNÂ‚˜[\ˆX›HX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜØØ[œÈ[˜X›H›İÈ]™[ÙXİ\š]NÂ‚‹KHKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKB‹KHÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œÈKHY[\İ[˜ŞKØÛÛÛİÛˆ˜XÚÚ[™ËØ[YB‹KHÚ\H[™\œÜÙH\È]™\Hİ\ˆ
—Ü™[Z[™\œÈX›H[ˆ\ÈÛÙX˜\ÙK‚‹KHKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKB˜Ü™X]HX›HYˆ›İ^\İÈX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œÈ
ˆY]ZYš[X\HÙ^HY˜][Ù[—Ü˜[™ÛWİ]ZY

Kˆ›Y×ÚY]ZY›İ[™Y™\™[˜Ù\ÈX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÙ›YÜÈ
Y
HÛˆ[]HØ\ØØYKˆ™[Z[™\—İ\H^›İ[ÚXÚÈ
™[Z[™\—İ\H[ˆ
ˆ	Ü™]šY]Ù\—Ü™[Z[™\‰Ë	İ[œ™\ÛÛ™YÜ™]šY]×Û›İYšXØ][Û‰Ë	Ü]\›—Ù]XİYÛ›İYšXØ][Û‰Âˆ
JKˆÙ[Ø][Y\İ[\ˆ›İ[Y˜][›İÊ
BŠNÂ‚˜Ü™X]H[™^Yˆ›İ^\İÈÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œ×Ù›Y×ÚYˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œÈ
›Y×ÚY™[Z[™\—İ\KÙ[Ø]\ØÊNÂ‚˜[\ˆX›HX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œÈ[˜X›H›İÈ]™[ÙXİ\š]NÂ™È		™YÚ[‚ˆÜ™X]HÛXŞH˜ÛÛ™\œØ][Ûˆ[YÜš]H™[Z[™\œÈYZ[ˆ[ˆÛˆX›XË˜ÛÛ™\œØ][Û—Ú[YÜš]WÜ™[Z[™\œÂˆ›Üˆ[ˆ\Ú[™È
^\İÈ
Ù[XİHœ›ÛHX›XËœ›Ùš[\ÈÚ\™HšYH]]ZY

H[™œ›ÛHH	ØYZ[‰ÊJBˆÚ]ÚXÚÈ
^\İÈ
Ù[XİHœ›ÛHX›XËœ›Ùš[\ÈÚ\™HšYH]]ZY

H[™œ›ÛHH	ØYZ[‰ÊJNÂ™^Ù\[ÛˆÚ[ˆ\XØ]WÛØš™Xİ[ˆ[È[™		Â