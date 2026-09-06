/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListSuggestions,
  adminSetSuggestionStatus,
  adminStats,
} from "@/lib/hackathons.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const statsQuery = queryOptions({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
const suggestionsQuery = queryOptions({
  queryKey: ["admin-suggestions"],
  queryFn: () => adminListSuggestions(),
});
export const Route = createFileRoute("/_authenticated/admin")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(statsQuery),
      context.queryClient.ensureQueryData(suggestionsQuery),
    ]),
  component: AdminPage,
});
function AdminPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: suggestions } = useSuspenseQuery(suggestionsQuery);
  const setStatus = useServerFn(adminSetSuggestionStatus);
  async function update(id: string, status: "approved" | "rejected") {
    try {
      await setStatus({ data: { id, status } });
      toast.success(`Suggestion ${status}.`);
    } catch (error: any) {
      toast.error(error.message ?? "Could not update suggestion");
    }
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Admin panel</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Students", stats.users],
          ["Hackathons", stats.hackathons],
          ["Teams", stats.teams],
          ["Pending", stats.pendingSuggestions],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Hackathon suggestions</h2>
        <div className="mt-3 space-y-3">
          {suggestions.map((suggestion: any) => (
            <div key={suggestion.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{suggestion.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.event_date || "Date not provided"} · {suggestion.status}
                  </p>
                  {suggestion.description && (
                    <p className="mt-2 text-sm">{suggestion.description}</p>
                  )}
                </div>
                {suggestion.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => update(suggestion.id, "approved")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update(suggestion.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No suggestions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
