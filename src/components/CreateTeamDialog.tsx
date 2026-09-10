import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { createTeam } from "@/lib/teams.functions";
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

export function CreateTeamDialog({
  hackathonId,
  minTeamSize,
  maxTeamSize,
}: {
  hackathonId: string;
  minTeamSize: number | null;
  maxTeamSize: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const create = useServerFn(createTeam);
  const [form, setForm] = useState({
    name: "",
    description: "",
    max_size: Math.max(minTeamSize ?? 1, Math.min(maxTeamSize ?? 4, 10)),
    needed_roles: "",
    whatsapp_link: "",
  });

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    setBusy(true);
    try {
      const team = await create({
        data: {
          hackathon_id: hackathonId,
          name: form.name,
          description: form.description,
          max_size: form.max_size,
          needed_roles: form.needed_roles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          whatsapp_link: form.whatsapp_link || null,
        },
      });
      toast.success("Team created! You're the first member.");
      setOpen(false);
      navigate({ to: "/teams/$id", params: { id: team.id } });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not create team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create a team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a public team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Null Pointer Exception"
            />
          </div>
          <div>
            <Label htmlFor="team-desc">What are you building / who do you need?</Label>
            <Textarea
              id="team-desc"
              value={form.description}
              rows={3}
              maxLength={2000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="team-size">Max team size (including you)</Label>
            <Input
              id="team-size"
              type="number"
              min={minTeamSize ?? 1}
              max={maxTeamSize ?? 10}
              value={form.max_size}
              onChange={(e) => setForm({ ...form, max_size: Number(e.target.value) || 4 })}
            />
            {(minTeamSize || maxTeamSize) && (
              <p className="mt-1 text-xs text-muted-foreground">
                This hackathon allows teams of {minTeamSize ?? 1}–{maxTeamSize ?? 10} members.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="team-roles">Roles needed (comma separated)</Label>
            <Input
              id="team-roles"
              value={form.needed_roles}
              onChange={(e) => setForm({ ...form, needed_roles: e.target.value })}
              placeholder="frontend, ML, design"
            />
          </div>
          <div>
            <Label htmlFor="team-wa">WhatsApp group invite link (optional, members only)</Label>
            <Input
              id="team-wa"
              value={form.whatsapp_link}
              type="url"
              onChange={(e) => setForm({ ...form, whatsapp_link: e.target.value })}
              placeholder="https://chat.whatsapp.com/…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Create a group in WhatsApp → Group info → Invite via link → paste it here. Only
              approved members see it.
            </p>
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create team"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
