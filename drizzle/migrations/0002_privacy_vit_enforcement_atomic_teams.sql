-- ============ helpers ============

create or replace function public.is_vit_user()
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(
    lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email') like '%@vitstudent.ac.in'
    or lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email') like '%@vit.ac.in',
    false
  )
$$;

create or replace function public.shares_team_with(_other_user_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships a
    join public.team_memberships b on a.team_id = b.team_id
    where a.user_id = _user_id and a.status = 'member'
      and b.user_id = _other_user_id and b.status = 'member'
  )
$$;

-- ============ profiles: stop leaking phone/email ============

drop policy if exists "profiles public read" on public.profiles;
revoke select on public.profiles from anon;

create policy "profiles read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles read teammates" on public.profiles
  for select to authenticated using (public.shares_team_with(id, auth.uid()));

drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id and public.is_vit_user());

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id and public.is_vit_user());

alter table public.profiles
  add constraint profiles_reg_number_format
  check (reg_number is null or reg_number ~ '^2[0-6][A-Z]{3}[0-9]{4}$');

alter table public.profiles
  add constraint profiles_phone_format
  check (phone is null or phone ~ '^[6-9][0-9]{9}$');

-- Public-safe projection (no phone, no email). Definer view bypasses RLS by design.
create view public.public_profiles as
  select id, full_name, reg_number, programme, skills, instagram, linkedin, github, avatar_url
  from public.profiles
  where reg_number is not null;

grant select on public.public_profiles to anon, authenticated;

create view public.public_organizers as
  select p.id, p.full_name, p.reg_number, p.programme, p.skills,
         p.instagram, p.linkedin, p.github, p.avatar_url
  from public.profiles p
  join public.user_roles r on r.user_id = p.id and r.role = 'admin';

grant select on public.public_organizers to anon, authenticated;

-- ============ team_memberships: hide pending/waitlist from the public ============

drop policy if exists "memberships public read" on public.team_memberships;

create policy "memberships members public read" on public.team_memberships
  for select using (status = 'member');

create policy "memberships read own" on public.team_memberships
  for select to authenticated using (auth.uid() = user_id);

create policy "memberships creator read" on public.team_memberships
  for select to authenticated using (public.is_team_creator(team_id, auth.uid()));

drop policy if exists "user request join" on public.team_memberships;
create policy "user request join" on public.team_memberships
  for insert to authenticated
  with check (auth.uid() = user_id and status in ('pending','waitlisted') and public.is_vit_user());

-- Public-safe membership projection for team pages
create view public.public_team_members as
  select m.id, m.team_id, m.user_id, m.created_at,
         p.full_name, p.reg_number, p.programme, p.skills, p.avatar_url
  from public.team_memberships m
  join public.profiles p on p.id = m.user_id
  where m.status = 'member';

grant select on public.public_team_members to anon, authenticated;

-- ============ VIT enforcement on other writes ============

drop policy if exists "user create team" on public.teams;
create policy "user create team" on public.teams
  for insert to authenticated with check (auth.uid() = creator_id and public.is_vit_user());

drop policy if exists "user insert suggestion" on public.hackathon_suggestions;
create policy "user insert suggestion" on public.hackathon_suggestions
  for insert to authenticated with check (auth.uid() = suggested_by and public.is_vit_user());

drop policy if exists "lft user insert" on public.looking_for_team;
create policy "lft user insert" on public.looking_for_team
  for insert to authenticated with check (auth.uid() = user_id and public.is_vit_user());

-- ============ suggestions -> published hackathon link ============

alter table public.hackathon_suggestions
  add column if not exists published_hackathon_id uuid references public.hackathons(id) on delete set null;

-- ============ atomic team admission ============

create or replace function public.join_team(_team_id uuid, _note text default '')
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _max int;
  _hid uuid;
  _end timestamptz;
  _count int;
  _status text;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if not public.is_vit_user() then raise exception 'Only VIT accounts are allowed'; end if;

  select t.max_size, t.hackathon_id into _max, _hid
  from public.teams t where t.id = _team_id for update;
  if not found then raise exception 'Team not found'; end if;

  select coalesce(h.ends_at, h.starts_at) into _end from public.hackathons h where h.id = _hid;
  if _end < now() then raise exception 'This hackathon has already happened - teams are locked.'; end if;

  select count(*) into _count from public.team_memberships
    where team_id = _team_id and status = 'member';

  _status := case when _count >= _max then 'waitlisted' else 'pending' end;

  insert into public.team_memberships (team_id, user_id, status, note)
  values (_team_id, _uid, _status, coalesce(_note, ''));

  return _status;
end;
$$;

create or replace function public.decide_membership(
  _membership_id uuid,
  _action text,
  _remove_membership_id uuid default null
)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _team_id uuid;
  _max int;
  _hid uuid;
  _end timestamptz;
  _count int;
begin
  if _uid is null then raise exception 'Not signed in'; end if;

  select m.team_id into _team_id from public.team_memberships m where m.id = _membership_id;
  if _team_id is null then raise exception 'Request not found'; end if;

  select t.max_size, t.hackathon_id into _max, _hid
  from public.teams t where t.id = _team_id and t.creator_id = _uid for update;
  if not found then raise exception 'Only the team creator can manage members'; end if;

  select coalesce(h.ends_at, h.starts_at) into _end from public.hackathons h where h.id = _hid;
  if _end < now() then raise exception 'This hackathon has already happened - teams are locked.'; end if;

  if _action = 'reject' then
    delete from public.team_memberships where id = _membership_id;
    return 'rejected';
  end if;

  if _remove_membership_id is not null then
    delete from public.team_memberships
      where id = _remove_membership_id and team_id = _team_id and status = 'member' and user_id <> _uid;
  end if;

  select count(*) into _count from public.team_memberships
    where team_id = _team_id and status = 'member';

  if _count >= _max then
    raise exception 'Team is full - remove a member first, or swap someone out.';
  end if;

  update public.team_memberships set status = 'member' where id = _membership_id;
  return 'member';
end;
$$;

revoke all on function public.join_team(uuid, text) from public;
revoke all on function public.decide_membership(uuid, text, uuid) from public;
grant execute on function public.join_team(uuid, text) to authenticated;
grant execute on function public.decide_membership(uuid, text, uuid) to authenticated;
grant execute on function public.is_vit_user() to anon, authenticated;
grant execute on function public.shares_team_with(uuid, uuid) to authenticated;