# HackMate VIT — Roadmap

## Part A — Missing screens (unblocks build)
- [x] /onboarding
- [x] /dashboard
- [x] /teams/:id (public members, creator controls, requests & waitlist)
- [x] /u/:regNo (public profile)
- [x] /suggest
- [x] /admin

## Part B — Privacy & VIT enforcement (DB level)
- [x] public-safe profiles view (no phone/email)
- [x] narrow team_memberships public read
- [x] VIT email constraint on writes
- [x] reg number format constraint

## Part C — Correctness
- [x] atomic join/approve/waitlist swap (row locks via join_team / decide_membership)
- [x] approve suggestion -> publish hackathon (admin approve dialog)
- [x] public organizers view
- [x] first-admin provisioning (claim_first_admin + dashboard card)

## Part D — Polish
- [ ] seed sample events (waiting on real event details from the organiser)
- [x] SEO head per route
- [x] empty/loading states
- [ ] final mobile pass
