-- Table for the bottom "Send Us a Message" contact form (server.js /api/contact,
-- read back by the admin panel at /admin). This replaces the local
-- private/submissions.json file, which never persisted across deploys.
--
-- No RLS policies are added on purpose: the server writes/reads with the
-- service_role key, which bypasses RLS entirely. With RLS enabled and no
-- policies, anon/public clients (e.g. someone calling the REST API directly
-- with your anon key) get zero access -- only the server can touch this table.

create extension if not exists pgcrypto;

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  nombre text not null,
  correo text not null,
  celular text not null,
  mensaje text not null
);

alter table public.contact_submissions enable row level security;
