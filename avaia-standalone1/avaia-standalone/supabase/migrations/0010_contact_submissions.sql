-- Contact form submissions — the public, unauthenticated form at /contact.
-- No RLS policies at all (service-role only, the same posture already used
-- for the Stripe webhook and the GPT OAuth tables): only the server-side
-- /api/contact route, using the admin client, can ever read or write this
-- table. There is no signed-in Host to scope rows to.

create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  reason     text not null check (reason in (
                'general', 'guiding', 'workshops', 'schools', 'certification', 'other'
              )),
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;
