# VIT Hackathon Team Finder — Build Plan

A platform for VIT students to discover hackathons and find teammates. You (the admin) list hackathons; students sign in with their VIT Google account, create or join teams, and coordinate payment themselves via WhatsApp.

## Core decisions (from your answers)

- **Payments:** No money flows through the site. Each team shows a WhatsApp group invite link (the team creator pastes it in); members settle fees in the group.
- **Teams:** Size limits, creator approval of join requests, leave/kick members, auto-lock when the event passes. **Plus a waitlist** — when a team is full, anyone can join its waitlist; the creator can swap out an existing member to admit someone from the waitlist.
- **Missing hackathons:** Users submit hackathon details → admin approval queue → you approve (goes live) or reject.
- **Profiles:** Everyone gets a public profile (name, reg number, branch, skills, socials, hackathon history). A dedicated "Organizer" section on the home page features you — photo, bio, socials (Instagram, LinkedIn, GitHub).

## Important constraints & flaws to flag

1. **VIT-only access:** Google sign-in returns the user's email; the site rejects any email not ending in `@vitstudent.ac.in` or `@vit.ac.in`. Enforcement happens server-side on every request, so it can't be bypassed.
2. **WhatsApp groups can't be auto-created** (WhatsApp has no official API for that). Realistic flow: the team creator generates the invite link in WhatsApp and pastes it into the team page. This is the standard workaround.
3. **Registration number validation:** enforced format `^2[0-6][A-Z]{3}[0-9]{4}$` (joining year 20–26, 3-letter programme code, 4-digit roll) — validated on the server, not just the form.
4. **50,000 users:** handled by Lovable Cloud's managed Postgres + auth; no special scaling work needed at launch. Public lists are paginated and indexed.
5. **Hackathon sources** (gravitas.vit.ac.in, vit.ac.in events): you'll add events manually through the admin panel. Automatic scraping is fragile (those sites change layout and may block bots); a manual "Add hackathon" form with a duplicate-date clash warning is more reliable. Flagging clashes between events at the same date/time is built in.

## What gets built

### 1. Auth & profiles (Lovable Cloud)
- Google sign-in only, restricted to `@vitstudent.ac.in` / `@vit.ac.in`.
- On first login: onboarding form — Name, Registration number (validated format), Phone, Programme/branch, skills, optional socials (Instagram, LinkedIn, GitHub), avatar.
- Public profile page per user (`/u/<reg-no>`) with skills, socials, and hackathon participation history.
- Roles table with `admin` role for your account; admin checks are server-side only.

### 2. Hackathon listings (public)
- Home page: upcoming hackathons with date, time, venue, fee, official link, deadline, tags, and clash warnings ("clashes with X on the same day").
- Detail page per hackathon: full details + all public teams for it + "request to join hackathon" (a looking-for-team board for users with no team yet).
- Past events auto-lock (teams become read-only) and move to an archive section.

### 3. Teams
- Create team per hackathon: name, size limit, description, needed skills/roles, WhatsApp invite link.
- Join flow: request to join → creator approves/rejects. When full, users join the **waitlist**; creator can admit a waitlisted person by swapping with a current member.
- Leave team / kick members; members shown with name, reg number, phone (phone visible to team members only).
- "My Teams" dashboard: teams I lead, teams I'm in, my pending join/waitlist requests.

### 4. Admin panel (you only)
- Add/edit/delete hackathons with the fields above; clash detector warns when dates overlap.
- Approval queue for user-submitted hackathons (approve → publish, or reject).
- Manage the homepage organizer spotlight (your photo, bio, socials).
- Basic stats: users, teams, requests.

### 5. User-submitted hackathons
- "Suggest a hackathon" form (name, date, fee, link, description) → lands in the admin queue.

## Pages

```text
/                     Home: organizer spotlight + upcoming hackathons
/hackathons           Full list (upcoming / past tabs)
/hackathons/:id       Details + teams + looking-for-team board
/teams/:id            Team page (members, join/waitlist, WhatsApp link)
/u/:regNo             Public user profile
/auth                 Google sign-in (VIT-only)
/dashboard            My teams & requests        (sign-in required)
/suggest              Suggest a hackathon        (sign-in required)
/admin                Admin panel                (you only)
```

## Data model (Lovable Cloud)

- `profiles` — user info, reg number, phone, skills, socials, avatar
- `user_roles` — admin role (separate table, security-definer `has_role`)
- `hackathons` — admin-approved events
- `hackathon_suggestions` — user submissions, pending/approved/rejected
- `teams` — per hackathon, size limit, creator, WhatsApp link
- `team_memberships` — status: member / pending / waitlisted
- All tables: GRANTs + RLS; phones and pending requests readable only by relevant members.

## Technical notes

- TanStack Start + Tailwind, server functions with `requireSupabaseAuth` for all writes.
- Google OAuth via Lovable's managed broker; domain check enforced in a server-side onboarding step.
- SEO: unique title/description per route; hackathon detail pages get og tags for sharing in WhatsApp groups.

## Build order

1. Enable Lovable Cloud → schema, RLS, Google auth with VIT-domain gate
2. Profiles + onboarding + public profile pages
3. Hackathon listings (public home, list, detail) + admin CRUD
4. Teams: create, join requests, waitlist, leave/kick, auto-lock
5. Suggest-a-hackathon + admin approval queue
6. Organizer spotlight, SEO tags, polish, test pass
