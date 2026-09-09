import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPublicProfile } from "@/lib/hackathons.functions";
const profileQuery = (regNumber: string) =>
  queryOptions({
    queryKey: ["profile", regNumber],
    queryFn: () => getPublicProfile({ data: { regNumber } }),
  });
export const Route = createFileRoute("/_authenticated/u/$regNo")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(profileQuery(params.regNo)),
  head: () => ({
    meta: [
      { title: "Student profile — HackMate VIT" },
      { name: "description", content: "Skills, programme and hackathon teams of a VIT student." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Profile unavailable</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <p className="p-12 text-center">No student with that number.</p>,
  component: ProfilePage,
});
function ProfilePage() {
  const { regNo } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(regNo));
  const { profile, teams } = data;
  const skills = profile.skills ?? [];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-3xl font-bold">{profile.full_name}</h1>
        <p className="mt-1 font-mono text-sm text-accent">{profile.reg_number}</p>
        {profile.programme && <p className="mt-3 text-muted-foreground">{profile.programme}</p>}
        {skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="rounded-full bg-secondary px-3 py-1 text-sm">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Teams</h2>
        <div className="mt-3 space-y-3">
          {teams.map((team) => (
            <p key={team.id} className="rounded-xl border border-border p-4">
              <span className="font-medium">{team.name}</span>
              {team.hackathon_title ? ` · ${team.hackathon_title}` : ""}
            </p>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-muted-foreground">No public team memberships yet.</p>
          )}
        </div>
      </section>
      <Link to="/dashboard" className="mt-8 inline-block text-sm text-accent hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
