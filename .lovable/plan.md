# Admin CSV export feature

Add a secure, admin-only export area to the existing admin panel so the organizer can download user/team/hackathon data as CSV files.

## What will be built

- New server functions in `src/lib/hackathons.functions.ts` (or a new `src/lib/exports.functions.ts`) that return CSV strings for:
  - **Users** — profile id, full name, registration number, programme, skills, email, phone, created_at.
  - **Teams** — team id, name, hackathon title, max size, needed roles, creator registration number, created_at.
  - **Memberships** — membership id, team name, member registration number, status, note, created_at.
  - **Suggestions** — suggestion id, title, status, suggested_by registration number, event_date, fee, created_at.
- Each export is protected by `requireSupabaseAuth`, VIT-email check, and `assertAdmin`.
- A new "Exports" section on `/_authenticated/admin` with one download button per CSV and a "Download all" zip option.
- CSV generation uses the browser-safe `Blob` + temporary anchor download pattern; no extra CSV library unless needed.

## Security and privacy

- Only admins can call export functions.
- Phone and email are included only in the Users export and only accessible to admins; public views already hide these fields.
- Server-side queries use `supabaseAdmin` or the authenticated `context.supabase` with admin RLS; no client-side direct table access.

## Verification

- Typecheck, lint, build, and format pass.
- Admin panel shows the new export buttons.
- Downloaded CSVs open correctly and contain expected columns.
