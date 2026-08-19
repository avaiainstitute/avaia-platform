-- AVAIA Guide Toolkit — Participant Record, Preparation, and the youth/group
-- session-context foundation.
--
-- 1. recognitions.conversation_id -- Unsung Heroes recognitions had no
--    structural link back to the conversation (or, for a Guide, the
--    guide_sessions row / participant) that produced them. Nullable and
--    additive: existing recognitions stay unlinked (honest -- there is no
--    way to reconstruct that association after the fact), and nothing about
--    the public Unsung Heroes flow's behavior changes -- the API route just
--    also stores the conversation_id it already has in hand. This is what
--    makes "Unsung Heroes sessions/recognitions where structurally
--    linkable" possible for the new Participant Record.
alter table public.recognitions
  add column if not exists conversation_id uuid
    references public.unsung_heroes_conversations (id) on delete set null;

create index if not exists recognitions_conversation_idx
  on public.recognitions (conversation_id);

-- 2. guide_sessions.session_context -- infrastructure only. Records which
--    authorized context a given Guide-facilitated session ran under. Every
--    tool installed so far only ever runs as an adult individual session,
--    so this column will read 'adult_individual' on every existing and
--    newly-created row until a youth or group tool actually exists to set
--    it otherwise -- nothing here invents youth/group behavior, prompts, or
--    UI. Deliberately NOT a participant-level field: whether a given
--    session ran as an individual or group conversation is a property of
--    the session, the same way `program` already is, not a permanent label
--    on the person. Group's eventual multi-participant mechanics (a session
--    with more than one participant_id) are an open question this column
--    does not attempt to answer -- deferred until a group tool is actually
--    specified, per the build direction not to invent that now.
alter table public.guide_sessions
  add column if not exists session_context text not null default 'adult_individual'
    check (session_context in ('adult_individual', 'youth_individual', 'group'));
