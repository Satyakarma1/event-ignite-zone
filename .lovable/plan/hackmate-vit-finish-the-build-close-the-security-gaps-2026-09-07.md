# HackMate VIT — Finish the Build & Close the Security Gaps

## What I found reviewing the repo

The review document lists "Task 1" as complete, but **those changes are not in this checkout**. There are no dashboard, admin, onboarding, suggest, team, or profile pages on disk — only the home page, sign-in page, and the two hackathon pages. So all eight findings are still open, and finding 1 and 2 are entirely open.

The app also **currently fails to build**. The signed-in section (`_authenticated/route.tsx`) exists with no pages inside it, which collides with the home page for the `/` address. Nothing loads until pages are added there.

Database check: 0 users, 0 hackathons, 0 admin accounts — the site is empty, which is expected at this stage.

## Findings confirmed against the code

| # | Finding | Status |
|---|---------|--------|
| 1 | Missing pages / broken routing | Confirmed — build fails |
| 2 | Server actions exist with no screens | Confirmed |
| 3 | Phone + email publicly readable | Confirmed — `profiles` is readable by anyone, all columns |
| 4 | VIT-only rule bypassable by direct database access | Confirmed |
| 5 | Team size limit not concurrency-safe | Confirmed |
| 6 | Approving a suggestion doesn't publish it | Confirmed |
| 7 | Organizer spotlight can never load | Confirmed — always shows "coming soon" |
| 8 | No way to become the first admin | Confirmed — no admin exists |

## Part A — Make the app work (findings 1 & 2)

Build the missing screens, which unblocks the build:

- **`/onboarding`** — first-login form: name, registration number (format-checked), phone, programme, skills, socials. Required before anything else.
- **`/dashboard`** — teams I lead (with pending + waitlist counts), teams I'm in, my requests, my suggestions.
- **`/teams/:id`** — public team page: members, roles wanted, capacity. For members: WhatsApp group link and teammates' phone numbers. For the creator: approve/reject requests, waitlist with swap-a-member admission, remove members, edit and delete the team. Locked once the event has passed.
- **`/u/:regNo`** — public profile: name, programme, skills, socials, hackathon history.
- **`/suggest`** — submit a hackathon for review.
- **`/admin`** — stats, add/edit/delete hackathons with clash warnings, and the suggestion approval queue.

Team pages and profiles stay **public** (shareable in WhatsApp groups), with sign-in prompts on actions; the rest sit behind sign-in.

## Part B — Lock down privacy (findings 3 & 4)

Phone numbers and email addresses are the sensitive part. Fix at the database level, not just in app code:

1. Remove blanket public read on `profiles`. Add a **public view** exposing only safe columns (name, registration number, programme, skills, socials, picture) — no phone, no email. Public pages read the view.
2. Phone numbers stay reachable only through the signed-in server path that already checks you're on the same team.
3. Narrow `team_memberships` public read to confirmed members only; pending/waitlist requests and their notes become visible to the requester and the team creator only.
4. **Enforce the VIT rule in the database**, so a non-VIT session can't write around the app: a check on every insert that the signed-in account's email ends in `@vitstudent.ac.in` or `@vit.ac.in`.
5. **Enforce the registration-number format in the database** with a constraint, mirroring the app's check.

## Part C — Correctness fixes (findings 5, 6, 7, 8)

- **Team capacity races (5):** move joining, approval, and waitlist swaps into single database functions that lock the team row, so two simultaneous approvals can never push a team over its size limit.
- **Approved suggestions (6):** approving no longer just flips a label. It opens the prefilled "Add hackathon" form so you set a real date and fee, then publishes the event and links it back to the suggestion. The free-text date/fee from users stays as a hint only.
- **Organizer spotlight (7):** expose organizer profiles through a small public view of admin accounts, so the section actually renders.
- **First admin (8):** granted directly in the database as a one-time step. **I need your VIT email address** to do this — tell me and I'll grant your account admin on first sign-in. Admin can then be granted to others from the admin panel.

## Part D — Content & polish

- Seed a handful of real Gravitas/VIT events so the site isn't empty on first visit.
- Per-page titles and descriptions; hackathon and team pages get link previews for WhatsApp sharing.
- Empty states, loading states, and mobile layout pass.

## Technical notes

- New migrations: public-safe views with grants, tightened RLS policies, VIT-email and registration-format constraints, and `SECURITY DEFINER` functions with `SELECT ... FOR UPDATE` row locks for join/approve/swap.
- `getOrganizers`, `getPublicProfile`, and `getHackathon` switch to the safe views.
- `adminSetSuggestionStatus` splits into reject and approve-and-publish paths.
- All new pages follow the existing loader + `useSuspenseQuery` pattern; protected pages live under `_authenticated`.

## Order of work

1. Missing screens (fixes the build)
2. Privacy and VIT enforcement migrations
3. Atomic team admission, suggestion publishing, organizer view
4. Admin provisioning + seed events
5. SEO, empty states, full click-through test
