-- Выполните этот SQL в Supabase → SQL Editor → New query.
create table if not exists public.user_notebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null default '{"projects":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_notebooks enable row level security;

create policy "Users can read their own notebook"
on public.user_notebooks for select
using (auth.uid() = user_id);

create policy "Users can insert their own notebook"
on public.user_notebooks for insert
with check (auth.uid() = user_id);

create policy "Users can update their own notebook"
on public.user_notebooks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
