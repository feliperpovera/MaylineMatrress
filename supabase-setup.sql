create extension if not exists pgcrypto;

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  name text not null,
  email text not null,
  phone text,
  delivery_area text not null,
  message text not null,
  source text not null default 'website-questionnaire'
);

alter table public.questionnaires enable row level security;

drop policy if exists "Public can insert questionnaires" on public.questionnaires;
create policy "Public can insert questionnaires"
on public.questionnaires
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated users can read questionnaires" on public.questionnaires;
create policy "Authenticated users can read questionnaires"
on public.questionnaires
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can update questionnaires" on public.questionnaires;
create policy "Authenticated users can update questionnaires"
on public.questionnaires
for update
to authenticated
using (true)
with check (true);
