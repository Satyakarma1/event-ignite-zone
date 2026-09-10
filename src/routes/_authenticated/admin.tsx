import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminCreateHackathon,
  adminListHackathons,
  adminListSuggestions,
  adminListUsers,
  adminRejectSuggestion,
  adminStats,
  adminUpdateHackathon,
  isAdmin,
} from "@/lib/hackathons.functions";
import {
  exportMembershipsCsv,
  exportSuggestionsCsv,
  exportTeamsCsv,
  exportUsersCsv,
} from "@/lib/exports.functions";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { downloadTextFile } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { profileToForm, suggestionStatusLabel, type ProfileForm } from "@/lib/admin.utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
const usersQuery = queryOptions({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
const hackathonsQuery = queryOptions({
  queryKey: ["admin-hackathons"],
  queryFn: () => adminListHackathons(),
});
const profileQuery = queryOptions({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => {
    const access = await isAdmin();
    if (!access.isAdmin) throw redirect({ to: "/dashboard" });
    return Promise.all([
      context.queryClient.ensureQueryData(statsQuery),
      context.queryClient.ensureQueryData(suggestionsQuery),
      context.queryClient.ensureQueryData(usersQuery),
      context.queryClient.ensureQueryData(hackathonsQuery),
      context.queryClient.ensureQueryData(profileQuery),
    ]);
  },
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
  participant_capacity: string;
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
  participant_capacity: "",
  tags: "",
};

function dateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function eventToForm(event: {
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_deadline: string | null;
  fee: number;
  website_url: string | null;
  venue: string | null;
  organizer_club: string | null;
  participant_capacity: number | null;
  tags: string[] | null;
}): EventForm {
  return {
    title: event.title,
    description: event.description ?? "",
    starts_at: dateInput(event.starts_at),
    ends_at: dateInput(event.ends_at),
    registration_deadline: dateInput(event.registration_deadline),
    fee: String(event.fee ?? 0),
    website_url: event.website_url ?? "",
    venue: event.venue ?? "",
    organizer_club: event.organizer_club ?? "",
    participant_capacity: event.participant_capacity ? String(event.participant_capacity) : "",
    tags: (event.tags ?? []).join(", "),
  };
}

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
    participant_capacity: form.participant_capacity ? Number(form.participant_capacity) : null,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
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
      <div>
        <Label htmlFor="participant_capacity">Maximum participants (optional)</Label>
        <Input
          id="participant_capacity"
          type="number"
          min={1}
          step={1}
          value={form.participant_capacity}
          onChange={(e) => setForm({ ...form, participant_capacity: e.target.value })}
          placeholder="e.g. 500"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="website">Official link</Label>
        <Input
          id="website"
          value={form.website_url}
          onChange={(e) => setForm({ ...form, website_url: e.target.value })}
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

function statusVariant(status: string) {
  return status === "rejected" ? "destructive" : status === "approved" ? "default" : "secondary";
}

function AdminPage() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: suggestions } = useSuspenseQuery(suggestionsQuery);
  const { data: users } = useSuspenseQuery(usersQuery);
  const { data: hackathons } = useSuspenseQuery(hackathonsQuery);
  const { data: profileData } = useSuspenseQuery(profileQuery);
  const queryClient = useQueryClient();
  const createHackathon = useServerFn(adminCreateHackathon);
  const updateHackathon = useServerFn(adminUpdateHackathon);
  const rejectSuggestion = useServerFn(adminRejectSuggestion);
  const saveProfile = useServerFn(updateProfile);
  const downloadUsers = useServerFn(exportUsersCsv);
  const downloadTeams = useServerFn(exportTeamsCsv);
  const downloadMemberships = useServerFn(exportMembershipsCsv);
  const downloadSuggestions = useServerFn(exportSuggestionsCsv);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<EventForm>(emptyEvent);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EventForm>(emptyEvent);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState<EventForm>(emptyEvent);
  const [profileForm, setProfileForm] = useState<ProfileForm>(() =>
    profileToForm(profileData.profile),
  );
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
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
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-hackathons"] });
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

  async function edit() {
    if (!editId || !editForm.title.trim() || !editForm.starts_at) {
      toast.error("Event name and start date are required.");
      return;
    }
    setBusy(true);
    try {
      await updateHackathon({ data: { id: editId, patch: toPayload(editForm) } });
      toast.success("Hackathon updated.");
      setEditId(null);
      refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update the hackathon");
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

  async function updateOwnerProfile() {
    setProfileBusy(true);
    try {
      await saveProfile({
        data: {
          ...profileForm,
          skills: profileForm.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
        },
      });
      toast.success("Organizer profile updated.");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["public-organizer"] });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update the profile");
    } finally {
      setProfileBusy(false);
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
      for (const action of exportActions)
        downloadTextFile(action.filename, await action.run(), "text/csv;charset=utf-8");
      toast.success("All CSV files downloaded.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not export all data");
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Admin panel</h1>
          <p className="mt-1 text-muted-foreground">Private workspace for HackMate VIT.</p>
        </div>
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

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Organizer profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These public-safe fields power the Run by card.
            </p>
          </div>
          <Button disabled={profileBusy} onClick={updateOwnerProfile}>
            {profileBusy ? "Saving…" : "Save profile"}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              "full_name",
              "reg_number",
              "programme",
              "phone",
              "instagram",
              "linkedin",
              "github",
              "avatar_url",
            ] as const
          ).map((field) => (
            <div key={field}>
              <Label htmlFor={`profile-${field}`}>{field.replaceAll("_", " ")}</Label>
              <Input
                id={`profile-${field}`}
                value={profileForm[field]}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, [field]: event.target.value })
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label htmlFor="profile-skills">Skills (comma separated)</Label>
            <Input
              id="profile-skills"
              value={profileForm.skills}
              onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Signed-in email is managed by Google and is not public.
          </p>
        </div>
      </section>

      <Tabs defaultValue="users" className="mt-10">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="hackathons">Hackathons ({hackathons.length})</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">Private owner-only student records.</p>
              </div>
              <Button variant="outline" onClick={refresh}>
                Refresh
              </Button>
            </div>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Skills</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name || "Unnamed"}</TableCell>
                      <TableCell>{user.reg_number || "—"}</TableCell>
                      <TableCell>{user.programme || "—"}</TableCell>
                      <TableCell>
                        <div>{user.email || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.phone || "No phone"}
                        </div>
                      </TableCell>
                      <TableCell>{(user.skills ?? []).join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No users yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="hackathons">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Hackathons</h2>
                <p className="text-sm text-muted-foreground">
                  Edit published event details at any time.
                </p>
              </div>
              <Button variant="outline" onClick={refresh}>
                Refresh
              </Button>
            </div>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Venue / club</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hackathons.map((hackathon) => (
                    <TableRow key={hackathon.id}>
                      <TableCell className="font-medium">{hackathon.title}</TableCell>
                      <TableCell>{fmtDateTime(hackathon.starts_at)}</TableCell>
                      <TableCell>₹{hackathon.fee}</TableCell>
                      <TableCell>{hackathon.participant_capacity ?? "—"}</TableCell>
                      <TableCell>{hackathon.venue || hackathon.organizer_club || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditId(hackathon.id);
                            setEditForm(eventToForm(hackathon));
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {hackathons.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No hackathons yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="suggestions">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Suggestions</h2>
                <p className="text-sm text-muted-foreground">
                  Decision history is visible only to you.
                </p>
              </div>
              <Button variant="outline" onClick={refresh}>
                Refresh
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{suggestion.title}</p>
                        <Badge variant={statusVariant(suggestion.status)}>
                          {suggestionStatusLabel(suggestion.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.event_date || "Date not provided"} ·{" "}
                        {suggestion.fee ? `₹${suggestion.fee}` : "fee not provided"}
                      </p>
                      {suggestion.description && (
                        <p className="mt-2 text-sm">{suggestion.description}</p>
                      )}
                      {suggestion.published_hackathon_id && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Published hackathon: {suggestion.published_hackathon_id}
                        </p>
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
        </TabsContent>
      </Tabs>

      <section className="mt-10 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">CSV snapshots</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each download reads the latest database data.
            </p>
          </div>
          <Button variant="outline" disabled={exportBusy !== null} onClick={downloadAllExports}>
            {exportBusy === "all" ? "Downloading…" : "Download all CSVs"}
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {exportActions.map((action) => (
            <Button
              key={action.key}
              variant="secondary"
              disabled={exportBusy !== null}
              onClick={() => downloadExport(action.key, action.filename, action.run)}
            >
              {exportBusy === action.key ? "Downloading…" : `Download ${action.label}`}
            </Button>
          ))}
        </div>
      </section>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit hackathon</DialogTitle>
          </DialogHeader>
          <EventFields form={editForm} setForm={setEditForm} />
          <Button disabled={busy} onClick={edit}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogContent>
      </Dialog>
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
