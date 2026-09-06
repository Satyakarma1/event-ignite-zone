/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeOnboarding } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: OnboardingPage });
function OnboardingPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeOnboarding);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    reg_number: "",
    programme: "",
    phone: "",
    skills: "",
    instagram: "",
    linkedin: "",
    github: "",
    avatar_url: "",
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await complete({
        data: {
          ...form,
          skills: form.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
        },
      });
      toast.success("Profile completed!");
      navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error(error.message ?? "Could not complete profile");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Set up your profile</h1>
      <p className="mt-2 text-muted-foreground">
        Your registration number is required before joining teams.
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="reg_number">Registration number</Label>
          <Input
            id="reg_number"
            required
            value={form.reg_number}
            onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
            placeholder="25BCE2129"
          />
        </div>
        <div>
          <Label htmlFor="programme">Programme</Label>
          <Input
            id="programme"
            value={form.programme}
            onChange={(e) => setForm({ ...form, programme: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            required
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="skills">Skills (comma separated)</Label>
          <Input
            id="skills"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
        </div>
        <Button disabled={busy}>{busy ? "Saving…" : "Finish setup"}</Button>
      </form>
    </div>
  );
}
