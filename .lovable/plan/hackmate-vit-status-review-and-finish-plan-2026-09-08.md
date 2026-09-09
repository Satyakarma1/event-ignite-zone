# HackMate VIT — status review and finish plan

## Where the project stands

The three merged pull requests did fix the routing problem. All nine pages now exist and are registered: home, hackathon list, hackathon detail, sign-in, onboarding, dashboard, suggest, team page, public profile, and admin. Navigation links no longer point at missing pages.

However, **the site does not build right now**, so nothing is viewable. Two concrete breakages:

1. `src/lib/teams.functions.ts` has the same import line twice (`Database`), which stops the build outright.
2. The admin page imports an action (`adminSetSuggestionStatus`) that no longer exists — it was split into a reject action and never got its approve counterpart.

There are also about a dozen type errors on the hackathon detail and onboarding pages (untyped values coming out of the data loader).

The database is further ahead than the app code. A privacy/atomicity migration is already applied and live: phone numbers and emails are no longer publicly readable, public-safe views exist for profiles, organizers and team members, registration-number and phone formats are enforced at the database level, VIT-email checks are enforced on every write, and there are proper single-transaction functions for joining a team and approving/swapping members. The app code only uses half of it.

## Findings review — done vs not done

| #   | Finding                                        | Status                                                                                                      |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Stale route tree, missing pages                | **Done** — all routes exist and are registered                                                              |
| 2   | Missing product screens                        | **Mostly done** — every screen exists; admin page is broken and several are thin                            |
| 3   | Phones/emails publicly readable                | **Done in the database**; hackathon pages use the safe views; team pages still read raw tables              |
| 4   | VIT rules bypassable by direct database access | **Done** — enforced by database rules and format checks                                                     |
| 5   | Team capacity/waitlist race conditions         | **Half done** — safe database functions exist, but the app still uses the old unsafe count-then-insert code |
| 6   | Approving a suggestion doesn't publish it      | **Not done** — reject works, approve-and-publish was never written                                          |
| 7   | Organizer spotlight can't load admins          | **Done** — reads the new public organizers view                                                             |
| 8   | No initial-admin provisioning                  | **Not done** — no admin exists and no way to create one from the app                                        |

Also worth knowing: the database is completely empty — no events, no users, no teams. So even once it builds, the home page will look bare until events are added.

## What I'll do next

### 1. Make it build again (first priority)

- Remove the duplicated import in the team actions file.
- Add the missing approve action and fix the admin page.
- Fix the type errors on the hackathon detail and onboarding pages.

### 2. Use the safety work that's already in the database

- Switch joining a team, approving, rejecting, and waitlist swaps over to the single-transaction database functions so two people clicking at once can't overfill a team.
- Switch the team page and dashboard to the public-safe views, keeping phone numbers visible only to confirmed teammates.

### 3. Approve-a-suggestion actually publishes

- Add an approve action that creates the live event from the suggestion and links the two together.
- Because suggested dates and fees are typed freely, approval opens a short confirm step where you fix up the date, time and fee before it goes live.

### 4. First admin

- Add a one-time claim step: the very first signed-in VIT account can claim admin if no admin exists yet, guarded in the database. After that the button disappears and existing admins grant the role.

### 5. Content and polish

- Add a handful of real upcoming VIT events so the site isn't empty.
- Page titles and share previews for the pages that don't have them yet.
- Empty states, loading states, and a mobile pass.

## Technical notes

- Broken build: duplicate `Database` import in `src/lib/teams.functions.ts`; `admin.tsx` imports a non-existent `adminSetSuggestionStatus`; TS7006/TS2339 errors in `hackathons/$id.tsx` and `onboarding.tsx`.
- Migration `0002_privacy_vit_enforcement_atomic_teams.sql` is applied: views `public_profiles`, `public_organizers`, `public_team_members`; functions `join_team`, `decide_membership`, `is_vit_user`, `shares_team_with`; reg-number/phone check constraints; `hackathon_suggestions.published_hackathon_id`.
- `requestJoin` / `setMembershipStatus` should become thin wrappers over `rpc('join_team')` and `rpc('decide_membership')`.
- New migration needed for: `approve_suggestion(...)` publishing helper and a `claim_first_admin()` security-definer function that inserts only when `user_roles` has no admin row and the caller passes `is_vit_user()`.
- Verification per change: `bunx tsc --noEmit`, `bun run lint`, `bun run build`.
