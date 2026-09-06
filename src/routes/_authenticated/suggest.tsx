/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestHackathon } from "@/lib/hackathons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suggest")({ component: SuggestPage });

function SuggestPage() {
  const submitSuggestion = useServerFn(suggestHackathon);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    fee: "",
    website_url: "",
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await submitSuggestion({ data: form });
      setForm({ title: "", description: "", event_date: "", fee: "", website_url: "" });
      toast.success("Thanks! Your suggestion was submitted.");
    } catch (error: any) {
      toast.error(error.message ?? "Could not submit suggestion");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Suggest a hackathon</h1>
      <p className="mt-2 text-muted-foreground">
        Know about a VIT hackathon? Send it to the organizers.
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <Label htmlFor="title">Event name</Label>
          <Input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="date">Date or timeframe</Label>
          <Input
            id="date"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="fee">Fee</Label>
          <Input
            id="fee"
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="description">Details</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <Button disabled={busy}>{busy ? "Submitting…" : "Submit suggestion"}</Button>
      </form>
    </div>
  );
}
