-- Public event capacity is informational; NULL keeps existing rows valid.
alter table public.hackathons
  add column if not exists participant_capacity integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hackathons_participant_capacity_positive'
  ) then
    alter table public.hackathons
      add constraint hackathons_participant_capacity_positive
      check (participant_capacity is null or participant_capacity > 0);
  end if;
end $$;

-- The site owner is configured by the server after the configured owner signs in.
create table if not exists public.site_owner (
  id boolean primary key default true check (id),
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.site_owner enable row level security;
revoke all on public.site_owner from anon, authenticated;
grant all on public.site_owner to service_role;

create or replace function public.is_site_owner(_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.site_owner where user_id = _user_id)
$$;

revoke all on function public.is_site_owner(uuid) from public;
grant execute on function public.is_site_owner(uuid) to authenticated;

drop policy if exists "admin insert hackathon" on public.hackathons;
create policy "owner insert hackathon" on public.hackathons
  for insert to authenticated
  with check (public.is_site_owner(auth.uid()));

drop policy if exists "admin update hackathon" on public.hackathons;
create policy "owner update hackathon" on public.hackathons
  for update to authenticated
  using (public.is_site_owner(auth.uid()))
  with check (public.is_site_owner(auth.uid()));

drop policy if exists "admin delete hackathon" on public.hackathons;
create policy "owner delete hackathon" on public.hackathons
  for delete to authenticated
  using (public.is_site_owner(auth.uid()));

drop policy if exists "user read own suggestion" on public.hackathon_suggestions;
create policy "user read own suggestion" on public.hackathon_suggestions
  for select to authenticated
  using (auth.uid() = suggested_by or public.is_site_owner(auth.uid()));

drop policy if exists "admin update suggestion" on public.hackathon_suggestions;
create policy "owner update suggestion" on public.hackathon_suggestions
  for update to authenticated
  using (public.is_site_owner(auth.uid()))
  with check (public.is_site_owner(auth.uid()));

create or replace view public.public_organizers as
  select p.id, p.full_name, p.reg_number, p.programme, p.skills,
         p.instagram, p.linkedin, p.github, p.avatar_url
  from public.profiles p
  join public.site_owner o on o.user_id = p.id;

grant select on public.public_organizers to anon, authenticated;

create or replace function public.is_vit_user()
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(
    lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
      ~ '^[^@[:space:]]+@(vitstudent\.ac\.in|vit\.ac\.in)$',
    false
  )
$$;

create or replace function public.enforce_vit_auth_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is null
     or lower(new.email::text) !~ '^[^@[:space:]]+@(vitstudent\.ac\.in|vit\.ac\.in)$' then
    raise exception 'Only VIT email accounts (@vitstudent.ac.in / @vit.ac.in) are allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_vit_auth_email on auth.users;
create trigger enforce_vit_auth_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_vit_auth_email();

revoke all on function public.enforce_vit_auth_email() from public, anon, authenticated;

create or replace function public.admin_exists()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.site_owner)
$$;

revoke all on function public.admin_exists() from public, anon, authenticated;

create or replace function public.claim_first_admin()
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  raise exception 'Admin access is configured for the site owner.';
end;
$$;

revoke all on function public.claim_first_admin() from public, anon, authenticated;
