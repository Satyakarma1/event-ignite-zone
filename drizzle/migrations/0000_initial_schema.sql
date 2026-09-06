create type public.app_role as enum ('admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  reg_number text unique,
  phone text,
  programme text,
  skills text[] default '{}',
  instagram text,
  linkedin text,
  github text,
  avatar_url text,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  registration_deadline timestamptz,
  fee integer not null default 0,
  website_url text,
  venue text,
  organizer_club text,
  tags text[] default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hackathon_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  event_date text,
  fee text,
  website_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  suggested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  name text not null,
  description text default '',
  max_size integer not null default 4 check (max_size between 1 and 10),
  needed_roles text[] default '{}',
  whatsapp_link text,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('member','pending','waitlisted')),
  note text default '',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Grants
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.profiles to anon;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select on public.hackathons to anon;
grant select, insert, update, delete on public.hackathons to authenticated;
grant all on public.hackathons to service_role;

grant select, insert, update, delete on public.hackathon_suggestions to authenticated;
grant all on public.hackathon_suggestions to service_role;

grant select on public.teams to anon;
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;

grant select on public.team_memberships to anon;
grant select, insert, update, delete on public.team_memberships to authenticated;
grant all on public.team_memberships to service_role;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.hackathons enable row level security;
alter table public.hackathon_suggestions enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- is_team_member helper (security definer, avoids recursive RLS)
create or replace function public.is_team_member(_team_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.team_memberships where team_id = _team_id and user_id = _user_id and status = 'member')
$$;

create or replace function public.is_team_creator(_team_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.teams where id = _team_id and creator_id = _user_id)
$$;

-- Profiles policies: anyone can read basic profile; owner updates own
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update to authenticated using (auth.uid() = id);

-- user_roles: users can read their own roles
create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- Hackathons: public read; only admin writes
create policy "hackathons public read" on public.hackathons for select using (true);
create policy "admin insert hackathon" on public.hackathons for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update hackathon" on public.hackathons for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete hackathon" on public.hackathons for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Suggestions: user inserts own, reads own; admin reads/updates all
create policy "user insert suggestion" on public.hackathon_suggestions for insert to authenticated with check (auth.uid() = suggested_by);
create policy "user read own suggestion" on public.hackathon_suggestions for select to authenticated using (auth.uid() = suggested_by or public.has_role(auth.uid(), 'admin'));
create policy "admin update suggestion" on public.hackathon_suggestions for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Teams: public read; signed-in user creates own; creator updates/deletes
create policy "teams public read" on public.teams for select using (true);
create policy "user create team" on public.teams for insert to authenticated with check (auth.uid() = creator_id);
create policy "creator update team" on public.teams for update to authenticated using (auth.uid() = creator_id);
create policy "creator delete team" on public.teams for delete to authenticated using (auth.uid() = creator_id);

-- Memberships: public read of members (names only via join); insert own request; creator manages
create policy "memberships public read" on public.team_memberships for select using (true);
create policy "user request join" on public.team_memberships for insert to authenticated with check (auth.uid() = user_id and status in ('pending','waitlisted'));
create policy "user delete own membership" on public.team_memberships for delete to authenticated using (auth.uid() = user_id);
create policy "creator manage memberships" on public.team_memberships for update to authenticated using (public.is_team_creator(team_id, auth.uid()));
create policy "creator delete memberships" on public.team_memberships for delete to authenticated using (public.is_team_creator(team_id, auth.uid()));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''), new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes for scale
create index hackathons_starts_at_idx on public.hackathons (starts_at);
create index teams_hackathon_idx on public.teams (hackathon_id);
create index memberships_team_idx on public.team_memberships (team_id);
create index memberships_user_idx on public.team_memberships (user_id);
create index suggestions_status_idx on public.hackathon_suggestions (status);