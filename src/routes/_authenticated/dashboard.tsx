/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMyDashboard } from "@/lib/teams.functions";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getMyDashboard() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({ meta: [{ title: "My teams — HackMate VIT" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">My dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Track your teams, requests, and hackathon suggestions.
      </p>
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">My teams</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.memberships.map(
            (membership: any) =>
              membership.teams && (
                <Link
                  key={membership.id}
                  to="/teams/$id"
                  params={{ id: membership.teams.id }}
                  className="rounded-xl border border-border bg-card p-4 hover:border-accent/60"
                >
                  <p className="font-semibold">{membership.teams.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {membership.teams.hackathons?.title} · {membership.status}
                  </p>
                </Link>
              ),
          )}
          {data.memberships.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              You have not joined a team yet.
            </p>
          )}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Teams I lead</h2>
        <div className="mt-3 space-y-3">
          {data.ledTeams.map((team: any) => (
            <Link
              key={team.id}
              to="/teams/$id"
              params={{ id: team.id }}
              className="block rounded-xl border border-border bg-card p-4 hover:border-accent/60"
            >
              <p className="font-semibold">{team.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {team.hackathons?.title} · {team.pending_count} pending · {team.waitlist_count}{" "}
                waitlisted
              </p>
            </Link>
          ))}
          {data.ledTeams.length === 0 && (
            <p className="text-sm text-muted-foreground">You are not leading any teams.</p>
          )}
        </div>
      </section>
    </div>
  );
}
