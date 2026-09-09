import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getTeam,
  getTeamAccess,
  getTeamRequests,
  kickMember,
  leaveTeam,
  requestJoin,
  setMembershipStatus,
} from "@/lib/teams.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const teamQuery = (id: string) =>
  queryOptions({ queryKey: ["team", id], queryFn: () => getTeam({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/teams/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(teamQuery(params.id)),
  head: () => ({
    meta: [
      { title: "Team — HackMate VIT" },
      { name: "description", content: "Team members, open spots and join requests." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Team unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <p className="p-12 text-center">This team no longer exists.</p>,
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(teamQuery(id));
  const queryClient = useQueryClient();
  const join = useServerFn(requestJoin);
  const decide = useServerFn(setMembershipStatus);
  const kick = useServerFn(kickMember);
  const leave = useServerFn(leaveTeam);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const access = useQuery({
    queryKey: ["team-access", id],
    queryFn: () => getTeamAccess({ data: { teamId: id } }),
  });
  const requests = useQuery({
    queryKey: ["team-requests", id],
    queryFn: () => getTeamRequests({ data: { teamId: id } }),
    enabled: !!access.data?.isCreator,
  });

  const isCreator = !!access.data?.isCreator;
  const myStatus = access.data?.myStatus ?? null;
  const members = data.members;
  const full = members.length >= data.team.max_size;
  const neededRoles = data.team.needed_roles ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["team", id] });
    queryClient.invalidateQueries({ queryKey: ["team-access", id] });
    queryClient.invalidateQueries({ queryKey: ["team-requests", id] });
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    setBusy(true);
    try {
      const result = await join({ data: { teamId: id, note } });
      toast.success(
        result.status === "waitlisted"
          ? "Team is full; you were added to its waitlist."
          : "Join request sent.",
      );
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not request to join");
    } finally {
      setBusy(false);
    }
  }

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
          {members.length}/{data.team.max_size} members{full ? " · full" : ""}
        </p>
        {neededRoles.length > 0 && (
          <p className="mt-2 text-sm">Looking for: {neededRoles.join(", ")}</p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Members</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {members.map((member) => (
            <div key={member.id} className="rounded-xl border border-border p-4">
              <p className="font-medium">{member.full_name}</p>
              {member.reg_number && (
                <Link
                  to="/u/$regNo"
                  params={{ regNo: member.reg_number }}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {member.reg_number}
                </Link>
              )}
              {isCreator && member.user_id !== access.data?.userId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={busy}
                  onClick={() =>
                    run(() => kick({ data: { membershipId: member.id } }), "Member removed.")
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {access.data?.memberPhones && access.data.memberPhones.length > 0 && (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="font-display text-lg font-semibold">Contact details (team only)</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {access.data.memberPhones.map((person, index) => (
              <li key={index}>
                {person.full_name} — {person.phone ?? "no number added"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isCreator && (requests.data?.requests.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Requests & waitlist</h2>
          <div className="mt-3 space-y-3">
            {requests.data?.requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.full_name}{" "}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {r.status}
                      </Badge>
                    </p>
                    {r.reg_number && (
                      <p className="font-mono text-xs text-muted-foreground">{r.reg_number}</p>
                    )}
                    {r.note && <p className="mt-2 text-sm">{r.note}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => decide({ data: { membershipId: r.id, action: "approve" } }),
                          "Added to the team.",
                        )
                      }
                    >
                      {full ? "Admit (needs a free spot)" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => decide({ data: { membershipId: r.id, action: "reject" } }),
                          "Request rejected.",
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {full && (
            <p className="mt-3 text-sm text-muted-foreground">
              The team is full — remove a member first, then admit someone from the waitlist.
            </p>
          )}
        </section>
      )}

      {access.data?.whatsapp_link && (
        <a
          className="mt-8 inline-block text-accent hover:underline"
          href={access.data.whatsapp_link}
          target="_blank"
          rel="noreferrer"
        >
          Open the team WhatsApp group
        </a>
      )}

      {myStatus === null && (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="font-display text-xl font-semibold">
            {full ? "Join the waitlist" : "Join this team"}
          </h2>
          <Textarea
            className="mt-3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Introduce yourself and your skills (optional)"
            maxLength={500}
          />
          <Button className="mt-3" onClick={request} disabled={busy}>
            {busy ? "Sending…" : full ? "Join waitlist" : "Request to join"}
          </Button>
        </section>
      )}

      {myStatus && myStatus !== "member" && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          Your request is {myStatus}. The team creator will get back to you.
        </p>
      )}

      {myStatus === "member" && !isCreator && (
        <Button
          variant="outline"
          className="mt-8"
          disabled={busy}
          onClick={() => run(() => leave({ data: { teamId: id } }), "You left the team.")}
        >
          Leave team
        </Button>
      )}
    </div>
  );
}
