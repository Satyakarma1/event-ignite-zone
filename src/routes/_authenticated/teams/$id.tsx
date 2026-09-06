/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getTeam, getTeamAccess, requestJoin } from "@/lib/teams.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const teamQuery = (id: string) =>
  queryOptions({ queryKey: ["team", id], queryFn: () => getTeam({ data: { id } }) });
export const Route = createFileRoute("/_authenticated/teams/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(teamQuery(params.id)),
  component: TeamPage,
});
function TeamPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(teamQuery(id));
  const join = useServerFn(requestJoin);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const access = useQuery({
    queryKey: ["team-access", id],
    queryFn: () => getTeamAccess({ data: { teamId: id } }),
  });
  async function request() {
    setBusy(true);
    try {
      const result = await join({ data: { teamId: id, note } });
      toast.success(
        result.status === "waitlisted"
          ? "Team is full; you were added to its waitlist."
          : "Join request sent.",
      );
    } catch (error: any) {
      toast.error(error.message ?? "Could not request to join");
    } finally {
      setBusy(false);
    }
  }
  const members = data.memberships.filter((membership: any) => membership.status === "member");
  const neededRoles = data.team.needed_roles ?? [];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/hackathons/$id"
        params={{ id: data.team.hackathon_id }}
        className="text-sm text-accent hover:underline"
      >
        ← {data.team.hackathons?.title}
      </Link>
      <div className="mt-4 rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-3xl font-bold">{data.team.name}</h1>
        {data.team.description && (
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{data.team.description}</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {members.length}/{data.team.max_size} members
        </p>
        {neededRoles.length > 0 && (
          <p className="mt-2 text-sm">Looking for: {neededRoles.join(", ")}</p>
        )}
      </div>
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Members</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {members.map((membership: any) => (
            <div key={membership.id} className="rounded-xl border border-border p-4">
              <p className="font-medium">{membership.profiles?.full_name ?? "Student"}</p>
              {membership.profiles?.reg_number && (
                <Link
                  to="/u/$regNo"
                  params={{ regNo: membership.profiles.reg_number }}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {membership.profiles.reg_number}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
      {access.data?.whatsapp_link ? (
        <a
          className="mt-8 inline-block text-accent hover:underline"
          href={access.data.whatsapp_link}
          target="_blank"
          rel="noreferrer"
        >
          Open the team WhatsApp group
        </a>
      ) : (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="font-display text-xl font-semibold">Join this team</h2>
          <Textarea
            className="mt-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Introduce yourself and your skills (optional)"
            maxLength={500}
          />
          <Button className="mt-3" onClick={request} disabled={busy}>
            {busy ? "Sending…" : "Request to join"}
          </Button>
        </section>
      )}
    </div>
  );
}
