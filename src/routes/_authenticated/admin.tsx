import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminCreateHackathon,
  adminListSuggestions,
  adminRejectSuggestion,
  adminStats,
} from "@/lib/hackathons.functions";
import {
  exportMembershipsCsv,
  exportSuggestionsCsv,
  exportTeamsCsv,
  exportUsersCsv,
} from "@/lib/exports.functions";
import { downloadTextFile } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  head: () => ({
    meta: [
      { title: "Admin panel — HackMate VIT" },
      { name: "description", content: "Manage events and student suggestions." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Admin only</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <p className="p-12 text-center">Not found.</p>,
  component: AdminPage,
});

type EventForm = {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  fee: string;
  website_url: string;
  venue: string;
  organizer_club: string;
  tags: string;
};

const emptyEvent: EventForm = {
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  registration_deadline: "",
  fee: "0",
  website_url: "",
  venue: "",
  organizer_club: "",
  tags: "",
};

function toPayload(form: EventForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    starts_at: new Date(form.starts_at).toISOString(),
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    registration_deadline: form.registration_deadline
      ? new Date(form.registration_deadline).toISOString()
      : null,
    fee: Number(form.fee || 0),
    website_url: form.website_url.trim() || null,
    venue: form.venue.trim() || null,
    organizer_club: form.organizer_club.trim() || null,
    tags: form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function EventFields({ form, setForm }: { form: EventForm; setForm: (f: EventForm) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="title">Event name</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="starts_at">Starts</Label>
        <Input
          id="starts_at"
          type="datetime-local"
          value={form.starts_at}
          onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="ends_at">Ends (optional)</Label>
        <Input
          id="ends_at"
          type="datetime-local"
          value={form.ends_at}
          onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="deadline">Registration deadline (optional)</Label>
        <Input
          id="deadline"
          type="datetime-local"
          value={form.registration_deadline}
          onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="fee">Fee (₹)</Label>
        <Input
          id="fee"
          type="number"
          min={0}
          value={form.fee}
          onChange={(e) => setForm({ ...form, fee: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          value={form.venue}
          onChange={(e) => setForm({ ...form, venue: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="club">Organising club</Label>
        <Input
          id="club"
          value={form.organizer_club}
          onChange={(e) => setForm({ ...form, organizer_club: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="website">Official link</Label>
        <Input
          id="website"
          value={form.website_url}
          onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          placeholder="https://gravitas.vit.ac.in/…"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
    </div>
  );
}

function AdminPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: suggestions } = useSuspenseQuery(suggestionsQuery);
  const queryClient = useQueryClient();
  const createHackathon = useServerFn(adminCreateHackathon);
  const rejectSuggestion = useServerFn(adminRejectSuggestion);
  const downloadUsers = useServerFn(exportUsersCsv);
  const downloadTeams = useServerFn(exportTeamsCsv);
  const downloadMemberships = useServerFn(exportMembershipsCsv);
  const downloadSuggestions = useServerFn(exportSuggestionsCsv);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<EventForm>(emptyEvent);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState<EventForm>(emptyEvent);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);

  const exportActions = [
    { key: "users", label: "Users", filename: "hackmate-users.csv", run: downloadUsers },
    { key: "teams", label: "Teams", filename: "hackmate-teams.csv", run: downloadTeams },
    {
      key: "memberships",
      label: "Memberships",
      filename: "hackmate-memberships.csv",
      run: downloadMemberships,
    },
    {
      key: "suggestions",
      label: "Suggestions",
      filename: "hackmate-suggestions.csv",
      run: downloadSuggestions,
    },
  ];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["hackathons"] });
  }

  async function publish(form: EventForm, fromSuggestionId: string | null) {
    if (!form.title.trim() || !form.starts_at) {
      toast.error("Event name and start date are required.");
      return;
    }
    setBusy(true);
    try {
      await createHackathon({ data: { hackathon: toPayload(form), fromSuggestionId } });
      toast.success(fromSuggestionId ? "Suggestion published." : "Event added.");
      setAddOpen(false);
      setApproveId(null);
      setAddForm(emptyEvent);
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save the event");
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    try {
      await rejectSuggestion({ data: { id } });
      toast.success("Suggestion rejected.");
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update the suggestion");
    }
  }

  async function downloadExport(key: string, filename: string, run: () => Promise<string>) {
    setExportBusy(key);
    try {
      downloadTextFile(filename, await run(), "text/csv;charset=utf-8");
      toast.success(`${filename} downloaded.`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not export data");
    } finally {
      setExportBusy(null);
    }
  }

  async function downloadAllExports() {
    setExportBusy("all");
    try {
      for (const exportAction of exportActions) {
        downloadTextFile(exportAction.filename, await exportAction.run(), "text/csv;charset=utf-8");
      }
      toast.success("All CSV files downloaded.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not export all data");
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Admin panel</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>Add hackathon</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add a hackathon</DialogTitle>
            </DialogHeader>
            <EventFields form={addForm} setForm={setAddForm} />
            <Button disabled={busy} onClick={() => publish(addForm, null)}>
              {busy ? "Saving…" : "Publish event"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

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

      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Exports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin-only CSV downloads. User exports include contact details.
            </p>
          </div>
          <Button variant="outline" disabled={exportBusy !== null} onClick={downloadAllExports}>
            {exportBusy === "all" ? "Downloading…" : "Download all CSVs"}
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {exportActions.map((exportAction) => (
            <Button
              key={exportAction.key}
              variant="secondary"
              disabled={exportBusy !== null}
              onClick={() =>
                downloadExport(exportAction.key, exportAction.filename, exportAction.run)
              }
            >
              {exportBusy === exportAction.key ? "Downloading…" : `Download ${exportAction.label}`}
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Hackathon suggestions</h2>
        <div className="mt-3 space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{suggestion.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.event_date || "Date not provided"} ·{" "}
                    {suggestion.fee ? `₹${suggestion.fee}` : "fee not provided"} ·{" "}
                    {suggestion.status}
                  </p>
                  {suggestion.description && (
                    <p className="mt-2 text-sm">{suggestion.description}</p>
                  )}
                </div>
                {suggestion.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveId(suggestion.id);
                        setApproveForm({
                          ...emptyEvent,
                          title: suggestion.title,
                          description: suggestion.description ?? "",
                          website_url: suggestion.website_url ?? "",
                          fee: (suggestion.fee ?? "").replace(/[^0-9]/g, "") || "0",
                        });
                      }}
                    >
                      Approve & publish
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(suggestion.id)}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No suggestions yet.
            </p>
          )}
        </div>
      </section>

      <Dialog open={!!approveId} onOpenChange={(open) => !open && setApproveId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm the details before publishing</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Students type dates and fees freely, so set the real date and fee here.
          </p>
          <EventFields form={approveForm} setForm={setApproveForm} />
          <Button disabled={busy} onClick={() => publish(approveForm, approveId)}>
            {busy ? "Publishing…" : "Publish event"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
