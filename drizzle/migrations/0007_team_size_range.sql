-- Team-size rules belong to each team in a hackathon, not to the event's total attendance.
-- The legacy participant_capacity column from 0004 is intentionally left in place and unused.
alter table public.hackathons
  add column if not exists min_team_size integer,
  add column if not exists max_team_size integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hackathons_team_size_bounds'
  ) then
    alter table public.hackathons
      add constraint hackathons_team_size_bounds
      check (
        (min_team_size is null or min_team_size between 1 and 10)
        and (max_team_size is null or max_team_size between 1 and 10)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'hackathons_team_size_range'
  ) then
    alter table public.hackathons
      add constraint hackathons_team_size_range
      check (
        (min_team_size is null and max_team_size is null)
        or (min_team_size is not null and max_team_size is not null and min_team_size <= max_team_size)
      );
  end if;
end $$;

-- Make the new columns available immediately to Supabase/PostgREST clients.
notify pgrst, 'reload schema';
