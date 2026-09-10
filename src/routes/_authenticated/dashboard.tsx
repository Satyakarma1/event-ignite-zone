/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyDashboard, removeLookingForTeam } from "@/lib/teams.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getMyDashboard() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({
    meta: [
      { title: "My teams — HackMate VIT" },
      { name: "description", content: "Your hackathon teams, join requests and waitlists." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Could not load your dashboard</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <p className="p-12 text-center">Not found.</p>,
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const queryClient = useQueryClient();
  const removeLooking = useServerFn(removeLookingForTeam);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function removePost(id: string) {
    if (!window.confirm("Remove this looking-for-team post?")) return;
    setRemovingId(id);
    try {
      await removeLooking({ data: { id } });
      toast.success("Looking-for-team post removed.");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not remove the post");
    } finally {
      setRemovingId(null);
    }
  }

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
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Looking for a team</h2>
        <div className="mt-3 space-y-3">
          {data.looking.map((post: any) => (
            <div
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{post.hackathons?.title ?? "Hackathon"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{post.note || "No note added"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={removingId !== null}
                onClick={() => removePost(post.id)}
              >
                {removingId === post.id ? "Removing…" : "Remove post"}
              </Button>
            </div>
          ))}
          {data.looking.length === 0 && (
            <p className="text-sm text-muted-foreground">You are not looking for a team yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
