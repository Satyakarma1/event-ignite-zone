import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { createPublicClient } from "./public.server";
import { assertVitEmail } from "./authz.server";

async function getHackathonLock(supabase: SupabaseClient<Database>, hackathonId: string) {
  const { data } = await supabase
    .from("hackathons")
    .select("starts_at, ends_at")
    .eq("id", hackathonId)
    .single();
  if (!data) throw new Error("Hackathon not found");
  const end = data.ends_at ?? data.starts_at;
  if (new Date(end).getTime() < Date.now()) {
    throw new Error("This hackathon has already happened — teams are locked.");
  }
}

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        hackathon_id: z.string().uuid(),
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(2000).default(""),
        max_size: z.number().int().min(1).max(10),
        needed_roles: z.array(z.string().trim().max(40)).max(10).default([]),
        whatsapp_link: z.string().trim().url().nullish().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await getHackathonLock(context.supabase, data.hackathon_id);
    const { data: team, error } = await context.supabase
      .from("teams")
      .insert({
        ...data,
        whatsapp_link: data.whatsapp_link || null,
        creator_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // creator is automatically a member
    const { error: mErr } = await context.supabase
      .from("team_memberships")
      .insert({ team_id: team.id, user_id: context.userId, status: "member" });
    if (mErr) throw new Error(mErr.message);
    return team;
  });

export const getTeam = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: team, error } = await supabase
      .from("teams")
      .select("*, hackathons(id, title, starts_at, ends_at)")
      .eq("id", data.id)
      .single();
    if (error || !team) throw new Error("Team not found");
    const { data: memberships } = await supabase
      .from("team_memberships")
      .select(
        "id, status, note, created_at, user_id, profiles(full_name, reg_number, programme, skills, avatar_url)",
      )
      .eq("team_id", data.id);
    const safe = (memberships ?? []).map((m) => ({
      ...m,
      profiles: m.profiles ? { ...m.profiles } : null,
    }));
    // WhatsApp link is only returned via getTeamAccess for members — strip here
    const { whatsapp_link, ...rest } = team;
    return { team: rest, memberships: safe };
  });

export const getTeamAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { data: team } = await context.supabase
      .from("teams")
      .select("creator_id, whatsapp_link")
      .eq("id", data.teamId)
      .single();
    if (!team) throw new Error("Team not found");
    const { data: membership } = await context.supabase
      .from("team_memberships")
      .select("status")
      .eq("team_id", data.teamId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const isMember = membership?.status === "member";
    const isCreator = team.creator_id === context.userId;
    // phone numbers of members visible only to members
    let memberPhones: { reg_number: string | null; phone: string | null; full_name: string }[] = [];
    if (isMember || isCreator) {
      const { data: rows } = await context.supabase
        .from("team_memberships")
        .select("profiles(full_name, reg_number, phone)")
        .eq("team_id", data.teamId)
        .eq("status", "member");
      memberPhones = (rows ?? []).flatMap((row) => (row.profiles ? [row.profiles] : []));
    }
    return {
      myStatus: membership?.status ?? null,
      isCreator,
      whatsapp_link: isMember || isCreator ? team.whatsapp_link : null,
      memberPhones,
    };
  });

export const requestJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ teamId: z.string().uuid(), note: z.string().trim().max(500).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { data: team } = await context.supabase
      .from("teams")
      .select("hackathon_id, max_size")
      .eq("id", data.teamId)
      .single();
    if (!team) throw new Error("Team not found");
    await getHackathonLock(context.supabase, team.hackathon_id);

    const { data: members } = await context.supabase
      .from("team_memberships")
      .select("status")
      .eq("team_id", data.teamId)
      .eq("status", "member");
    const full = (members?.length ?? 0) >= team.max_size;
    const status = full ? "waitlisted" : "pending";

    const { error } = await context.supabase
      .from("team_memberships")
      .insert({ team_id: data.teamId, user_id: context.userId, status, note: data.note });
    if (error) {
      if (error.code === "23505") throw new Error("You already requested to join this team.");
      throw new Error(error.message);
    }
    return { status };
  });

export const setMembershipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        membershipId: z.string().uuid(),
        action: z.enum(["approve", "reject", "admit_waitlist"]),
        removeMembershipId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { data: membership } = await context.supabase
      .from("team_memberships")
      .select("id, team_id, status")
      .eq("id", data.membershipId)
      .single();
    if (!membership) throw new Error("Request not found");

    const { data: team } = await context.supabase
      .from("teams")
      .select("creator_id, hackathon_id, max_size")
      .eq("id", membership.team_id)
      .single();
    if (!team || team.creator_id !== context.userId)
      throw new Error("Only the team creator can manage members");
    await getHackathonLock(context.supabase, team.hackathon_id);

    if (data.action === "reject") {
      const { error } = await context.supabase
        .from("team_memberships")
        .delete()
        .eq("id", data.membershipId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { data: members } = await context.supabase
      .from("team_memberships")
      .select("id")
      .eq("team_id", membership.team_id)
      .eq("status", "member");
    const full = (members?.length ?? 0) >= team.max_size;

    if (full) {
      if (data.action !== "admit_waitlist" || !data.removeMembershipId) {
        throw new Error("Team is full — remove a member first or use the waitlist swap.");
      }
      const { error: delErr } = await context.supabase
        .from("team_memberships")
        .delete()
        .eq("id", data.removeMembershipId);
      if (delErr) throw new Error(delErr.message);
    }

    const { error } = await context.supabase
      .from("team_memberships")
      .update({ status: "member" })
      .eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase
      .from("team_memberships")
      .delete()
      .eq("team_id", data.teamId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const kickMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ membershipId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { data: membership } = await context.supabase
      .from("team_memberships")
      .select("team_id, user_id")
      .eq("id", data.membershipId)
      .single();
    if (!membership) throw new Error("Member not found");
    const { data: team } = await context.supabase
      .from("teams")
      .select("creator_id")
      .eq("id", membership.team_id)
      .single();
    if (!team || team.creator_id !== context.userId)
      throw new Error("Only the team creator can remove members");
    if (membership.user_id === context.userId) throw new Error("You can't remove yourself");
    const { error } = await context.supabase
      .from("team_memberships")
      .delete()
      .eq("id", data.membershipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase
      .from("teams")
      .delete()
      .eq("id", data.teamId)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        teamId: z.string().uuid(),
        name: z.string().trim().min(2).max(100),
        description: z.string().trim().max(2000).default(""),
        max_size: z.number().int().min(1).max(10),
        needed_roles: z.array(z.string().trim().max(40)).max(10).default([]),
        whatsapp_link: z.string().trim().url().nullish().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { teamId, ...patch } = data;
    const { error } = await context.supabase
      .from("teams")
      .update({ ...patch, whatsapp_link: patch.whatsapp_link || null })
      .eq("id", teamId)
      .eq("creator_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    const { data: memberships } = await context.supabase
      .from("team_memberships")
      .select(
        "id, status, created_at, teams(id, name, max_size, creator_id, hackathons(id, title, starts_at))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    const { data: ledTeams } = await context.supabase
      .from("teams")
      .select("id, name, max_size, hackathons(id, title, starts_at), team_memberships(status)")
      .eq("creator_id", context.userId)
      .order("created_at", { ascending: false });

    const { data: suggestions } = await context.supabase
      .from("hackathon_suggestions")
      .select("id, title, status, created_at")
      .eq("suggested_by", context.userId)
      .order("created_at", { ascending: false });

    const { data: looking } = await context.supabase
      .from("looking_for_team")
      .select("id, note, hackathons(id, title)")
      .eq("user_id", context.userId);

    return {
      memberships: memberships ?? [],
      ledTeams: (ledTeams ?? []).map((t) => ({
        ...t,
        pending_count: (t.team_memberships ?? []).filter(
          (membership) => membership.status === "pending",
        ).length,
        waitlist_count: (t.team_memberships ?? []).filter(
          (membership) => membership.status === "waitlisted",
        ).length,
        team_memberships: undefined,
      })),
      suggestions: suggestions ?? [],
      looking: looking ?? [],
    };
  });

export const postLookingForTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ hackathonId: z.string().uuid(), note: z.string().trim().max(500).default("") })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await getHackathonLock(context.supabase, data.hackathonId);
    const { error } = await context.supabase
      .from("looking_for_team")
      .insert({ hackathon_id: data.hackathonId, user_id: context.userId, note: data.note });
    if (error) {
      if (error.code === "23505")
        throw new Error("You already posted a request for this hackathon.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeLookingForTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase
      .from("looking_for_team")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
