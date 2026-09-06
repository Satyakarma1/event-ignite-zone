import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listHackathons } from "@/lib/hackathons.functions";
import { HackathonCard } from "@/components/HackathonCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPast } from "@/lib/format";

const hackathonsQuery = queryOptions({ queryKey: ["hackathons"], queryFn: () => listHackathons() });

export const Route = createFileRoute("/hackathons/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hackathonsQuery),
  head: () => ({
    meta: [
      { title: "All Hackathons — HackMate VIT" },
      {
        name: "description",
        content: "Every upcoming and past hackathon at VIT, with teams recruiting members.",
      },
      { property: "og:title", content: "All Hackathons — HackMate VIT" },
      {
        property: "og:description",
        content: "Every upcoming and past hackathon at VIT, with teams recruiting members.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HackathonsPage,
});

function HackathonsPage() {
  const { data: hackathons } = useSuspenseQuery(hackathonsQuery);
  const upcoming = hackathons.filter((h) => !isPast(h.ends_at, h.starts_at));
  const past = hackathons
    .filter((h) => isPast(h.ends_at, h.starts_at))
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Hackathons</h1>
      <p className="mt-2 text-muted-foreground">
        Every listed event. Click one to see the teams recruiting for it.
      </p>
      <Tabs defaultValue="upcoming" className="mt-8">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Nothing upcoming right now.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((h) => (
                <HackathonCard key={h.id} hackathon={h} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((h) => (
              <HackathonCard key={h.id} hackathon={h} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
