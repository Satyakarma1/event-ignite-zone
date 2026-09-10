-- Suggestion decisions are private to the configured site owner.
drop policy if exists "user read own suggestion" on public.hackathon_suggestions;
drop policy if exists "owner read suggestions" on public.hackathon_suggestions;

create policy "owner read suggestions" on public.hackathon_suggestions
  for select to authenticated
  using (public.is_site_owner(auth.uid()));
