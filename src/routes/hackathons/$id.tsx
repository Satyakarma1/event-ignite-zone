import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CalendarDays,
  IndianRupee,
  MapPin,
  ExternalLink,
  AlertTriangle,
  Users,
  Plus,
  HandMetal,
} from "lucide-react";
import { getHackathon } from "@/lib/hackathons.functions";
import { postLookingForTeam } from "@/lib/teams.functions";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, fmtFee, isPast } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreateTeamDialog } from "@/components/CreateTeamDialog";

const detailQuery = (id: string) =>
  queryOptions({ queryKey: ["hackathon", id], queryFn: () => getHackathon({ data: { id } }) });

export const Route = createFileRoute("/hackathons/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(detailQuery(params.id)),
  head: ({ match }) => ({
    meta: [
      { title: "Hackathon details — HackMate VIT" },
      {
        name: "description",
        content: "Hackathon details, recruiting teams, and students looking for a team.",
      },
      { property: "og:title", content: "Hackathon — HackMate VIT" },
      { property: "og:description", content: "See details and find a team for this hackathon." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HackathonDetail,
});

function HackathonDetail() {
  const { id } = useParams({ from: "/hackathons/$id" });
  const { data } = useSuspenseQuery(detailQuery(id));
  const { hackathon, clashes, teams, looking } = data;
  const past = isPast(hackathon.ends_at, hackathon.starts_at);
  const queryClient = useQueryClient();
  const postLooking = useServerFn(postLookingForTeam);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });

  const [note, setNote] = useState("");
  const [lookingOpen, setLookingOpen] = useState(false);

  async function submitLooking() {
    try {
      await postLooking({ data: { hackathonId: id, note } });
      toast.success("Posted! Others can now see you're looking for a team.");
      setLookingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["hackathon", id] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not post request");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-center gap-2">
          {past && <Badge variant="secondary">Ended — teams locked</Badge>}
          {(hackathon.tags ?? []).map((t) => (
            <Badge key={t} variant="outline" className="font-mono text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{hackathon.title}</h1>
        {hackathon.organizer_club && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">{hackathon.organizer_club}</p>
        )}
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-accent" />
            <span>
              {fmtDateTime(hackathon.starts_at)}
              {hackathon.ends_at ? ` → ${fmtDateTime(hackathon.ends_at)}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <IndianRupee className="h-4 w-4 text-accent" /> {fmtFee(hackathon.fee)}
          </div>
          {hackathon.venue && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-accent" /> {hackathon.venue}
            </div>
          )}
          {hackathon.website_url && (
            <a
              href={hackathon.website_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 font-medium text-accent hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> Official website
            </a>
          )}
        </div>
        {hackathon.registration_deadline && (
          <p className="mt-3 text-sm text-muted-foreground">
            Registration deadline:{" "}
            <span className="font-medium text-foreground">
              {fmtDateTime(hackathon.registration_deadline)}
            </span>
          </p>
        )}
        {clashes.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              Clashes with{" "}
              {clashes.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link
                    to="/hackathons/$id"
                    params={{ id: c.id }}
                    className="font-medium text-accent hover:underline"
                  >
                    {c.title}
                  </Link>
                </span>
              ))}{" "}
              around the same time.
            </span>
          </div>
        )}
        {hackathon.description && (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {hackathon.description}
          </p>
        )}
      </div>

      {/* Teams */}
      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Users className="h-5 w-5 text-accent" /> Teams recruiting ({teams.length})
          </h2>
          {!past &&
            (session ? (
              <CreateTeamDialog hackathonId={id} />
            ) : (
              <Button asChild>
                <Link to="/auth">Sign in to create a team</Link>
              </Button>
            ))}
        </div>
        {teams.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No teams yet — be the first to create one.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const full = t.member_count >= t.max_size;
              return (
                <Link
                  key={t.id}
                  to="/teams/$id"
                  params={{ id: t.id }}
                  className="rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold">{t.name}</h3>
                    <Badge
                      variant={full ? "secondary" : "default"}
                      className={full ? "" : "bg-accent text-accent-foreground"}
                    >
                      {t.member_count}/{t.max_size} {full ? "· full" : ""}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(t.needed_roles ?? []).map((r) => (
                      <Badge key={r} variant="outline" className="font-mono text-[10px]">
                        {r}
                      </Badge>
                    ))}
                    {full && (
                      <Badge variant="outline" className="text-[10px]">
                        waitlist open
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Looking for team */}
      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <HandMetal className="h-5 w-5 text-accent" /> Looking for a team ({looking.length})
          </h2>
          {!past && session && (
            <Dialog open={lookingOpen} onOpenChange={setLookingOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> I want to join
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tell teams why they should pick you</DialogTitle>
                </DialogHeader>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Your skills, experience, what you can build…"
                  rows={4}
                  maxLength={500}
                />
                <Button onClick={submitLooking}>Post request</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {looking.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Nobody here yet. Post a request and team creators can spot you.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {looking.map((l) => (
              <div key={l.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{l.profiles?.full_name ?? "Student"}</span>
                    {l.profiles?.reg_number && (
                      <Link
                        to="/u/$regNo"
                        params={{ regNo: l.profiles.reg_number }}
                        className="ml-2 font-mono text-xs text-accent hover:underline"
                      >
                        {l.profiles.reg_number}
                      </Link>
                    )}
                  </div>
                  {l.profiles?.programme && (
                    <span className="text-xs text-muted-foreground">{l.profiles.programme}</span>
                  )}
                </div>
                {l.note && <p className="mt-2 text-sm text-muted-foreground">{l.note}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(l.profiles?.skills ?? []).slice(0, 5).map((s: string) => (
                    <Badge key={s} variant="outline" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
