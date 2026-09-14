-- Agent System Completion: finishing Agent 9 (Communications & Content) as
-- a genuinely usable approval pipeline, and giving the Founder Idea Catcher
-- a real path into it, rather than two disconnected tables.

-- ---------------------------------------------------------------------------
-- avaia_content_items.status: the pipeline Dorian actually asked for is
-- IDEAS / DRAFTS / WAITING FOR APPROVAL / APPROVED / SCHEDULED / PUBLISHED.
-- 'draft' and 'approved' already existed but nothing distinguished "still
-- being written" from "ready for Dorian's go-ahead" -- both were only ever
-- 'draft'. Adds the missing explicit gate; 'archived' is kept as the
-- existing housekeeping/terminal state, unrelated to this pipeline. Same
-- drop-and-re-add pattern as every other status/feature check constraint
-- widened so far (0045, 0072, 0073).
alter table public.avaia_content_items drop constraint if exists avaia_content_items_status_check;
alter table public.avaia_content_items add constraint avaia_content_items_status_check check (status in (
  'idea', 'draft', 'waiting_for_approval', 'approved', 'scheduled', 'published', 'archived'
));

-- ---------------------------------------------------------------------------
-- founder_notes.linked_content_item_id: lets a Founder Idea Catcher entry
-- (kind = 'idea') be promoted into a real avaia_content_items row without
-- retyping it, the same "reuse existing records instead of duplicating"
-- principle 0073's other four linked_*_id columns already follow. Nullable,
-- and only ever set by that one explicit promotion action (see
-- app/admin/notes/page.tsx) -- an idea is never auto-promoted, and
-- promoting it never publishes or schedules anything by itself.
alter table public.founder_notes
  add column if not exists linked_content_item_id uuid references public.avaia_content_items (id) on delete set null;
