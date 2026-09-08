create or replace function public.claim_first_admin()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  if not public.is_vit_user() then raise exception 'Only VIT accounts are allowed'; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;
  insert into public.user_roles (user_id, role) values (_uid, 'admin')
  on conflict (user_id, role) do nothing;
  return true;
end;
$$;

revoke all on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

create or replace function public.admin_exists()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where role = 'admin') $$;

grant execute on function public.admin_exists() to anon, authenticated;