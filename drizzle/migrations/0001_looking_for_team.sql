create table public.looking_for_team (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text default '',
  created_at timestamptz not null default now(),
  unique (hackathon_id, user_id)
);

grant select on public.looking_for_team to anon;
grant select, insert, delete on public.looking_for_team to authenticated;
grant all on public.looking_for_team to service_role;

alter table public.looking_for_team enable row level security;

create policy "lft public read" on public.looking_for_team for select using (true);
create policy "lft user insert" on public.looking_for_team for insert to authenticated with check (auth.uid() = user_id);
create policy "lft user delete own" on public.looking_for_team for delete to authenticated using (auth.uid() = user_id);

create index lft_hackathon_idx on public.looking_for_team (hackathon_id);