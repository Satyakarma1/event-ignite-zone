import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Github, Instagram, Linkedin, ArrowRight, Users, Zap } from "lucide-react";
import { listHackathons, getOrganizers } from "@/lib/hackathons.functions";
import { HackathonCard } from "@/components/HackathonCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isPast } from "@/lib/format";

const hackathonsQuery = queryOptions({ queryKey: ["hackathons"], queryFn: () => listHackathons() });
const organizersQuery = queryOptions({ queryKey: ["organizers"], queryFn: () => getOrganizers() });

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(hackathonsQuery),
      context.queryClient.ensureQueryData(organizersQuery),
    ]),
  head: () => ({
    meta: [
      { title: "HackMate VIT — Find Hackathon Teammates" },
      {
        name: "description",
        content:
          "Stop hunting for hackathon teammates in buried WhatsApp groups. Browse VIT hackathons, create or join a team, and compete.",
      },
      { property: "og:title", content: "HackMate VIT — Find Hackathon Teammates" },
      {
        property: "og:description",
        content: "Browse VIT hackathons, create or join a team, and find your people.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: hackathons } = useSuspenseQuery(hackathonsQuery);
  const { data: organizers } = useSuspenseQuery(organizersQuery);
  const upcoming = hackathons.filter((h) => !isPast(h.ends_at, h.starts_at)).slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
            VIT Hackathon Team Finder
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Your next hackathon team is not in a WhatsApp group.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Browse every hackathon at VIT, create a public team, or join one that's recruiting.
            No more buried messages — just teammates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/hackathons">
                Browse hackathons <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/suggest">Suggest a hackathon</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Zap className="h-5 w-5 text-accent" /> Upcoming hackathons
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick an event, then find or create your team.
            </p>
          </div>
          <Link to="/hackathons" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No upcoming hackathons listed yet — check back soon or suggest one.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((h) => (
              <HackathonCard key={h.id} hackathon={h} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3">
          {[
            ["01", "Sign in with VIT email", "Google sign-in restricted to @vitstudent.ac.in and @vit.ac.in accounts."],
            ["02", "Create or join a team", "Post a public team with the skills you need, or request to join one that's recruiting."],
            ["03", "Coordinate on WhatsApp", "The team creator shares a group invite link — you sort registration and payment there."],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span className="font-mono text-sm text-accent">{n}</span>
              <h3 className="mt-2 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Organizer spotlight */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Users className="h-5 w-5 text-accent" /> Run by
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizers.length === 0 && (
            <p className="text-sm text-muted-foreground">Organizer profile coming soon.</p>
          )}
          {organizers.map((o) => (
            <div key={o.reg_number ?? o.full_name} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={o.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {(o.full_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-display font-semibold">{o.full_name || "Organizer"}</p>
                  {o.programme && <p className="text-xs text-muted-foreground">{o.programme}</p>}
                  {o.reg_number && (
                    <Link
                      to="/u/$regNo"
                      params={{ regNo: o.reg_number }}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {o.reg_number}
                    </Link>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-3 text-muted-foreground">
                {o.instagram && (
                  <a href={o.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-accent">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {o.linkedin && (
                  <a href={o.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-accent">
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {o.github && (
                  <a href={o.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="hover:text-accent">
                    <Github className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
