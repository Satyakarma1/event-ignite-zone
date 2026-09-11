import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./public.server";
import { assertAdmin, assertVitEmail } from "./authz.server";
import { teamSizeLimitError } from "./team-size.utils";

async function getHackathonLock(supabase: SupabaseClient<Database>, hackathonId: string) {
  const { data } = await supabase
    .from("hackathons")
    .select("starts_at, ends_at, min_team_size, max_team_size")
    .eq("id", hackathonId)
    .single();
  if (!data) throw new Error("Hackathon not found");
  const end = data.ends_at ?? data.starts_at;
  if (new Date(end).getTime() < Date.now()) {
    throw new Error("This hackathon has already happened — teams are locked.");
  }
  return data;
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
    const hackathon = await getHackathonLock(context.supabase, data.hackathon_id);
    const teamSizeError = teamSizeLimitError(
      data.max_size,
      hackathon.min_team_size,
      hackathon.max_team_size,
    );
    if (teamSizeError) throw new Error(teamSizeError);
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

    // Only confirmed members are public, and only through the safe view.
    const { data: memberRows } = await supabase
      .from("public_team_members")
      .select("id, user_id, full_name, reg_number, programme, skills, avatar_url")
      .eq("team_id", data.id);

    const members = (memberRows ?? []).map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string | null,
      full_name: (m.full_name as string | null) ?? "Student",
      reg_number: m.reg_number as string | null,
      programme: m.programme as string | null,
      skills: (m.skills as string[] | null) ?? [],
      avatar_url: m.avatar_url as string | null,
    }));

    // WhatsApp link is only returned via getTeamAccess for members — strip here
    const { whatsapp_link: _link, ...rest } = team;
    return { team: rest, members };
  });

/** Creator-only: pending join requests and waitlist for a team. */
export const getTeamRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: team } = await context.supabase
      .from("teams")
      .select("creator_id")
      .eq("id", data.teamId)
      .single();
    if (!team || team.creator_id !== context.userId) return { requests: [] };

    const { data: rows } = await context.supabase
      .from("team_memberships")
      .select("id, status, note, created_at, user_id")
      .eq("team_id", data.teamId)
      .in("status", ["pending", "waitlisted"])
      .order("created_at", { ascending: true });

    const userIds = (rows ?? []).map((r) => r.user_id);
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, reg_number, programme")
          .in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      requests: (rows ?? []).map((r) => {
        const profile = byId.get(r.user_id);
        return {
          id: r.id,
          status: r.status,
          note: r.note ?? "",
          full_name: profile?.full_name ?? "Student",
          reg_number: profile?.reg_number ?? null,
          programme: profile?.programme ?? null,
        };
      }),
    };
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
        .select("user_id")
        .eq("team_id", data.teamId)
        .eq("status", "member");
      const ids = (rows ?? []).map((row) => row.user_id);
      if (ids.length) {
        const { data: profiles } = await context.supabase
          .from("profiles")
          .select("full_name, reg_number, phone")
          .in("id", ids);
        memberPhones = (profiles ?? []).map((p) => ({
          full_name: p.full_name,
          reg_number: p.reg_number,
          phone: p.phone,
        }));
      }
    }
    return {
      userId: context.userId,
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
    // Single transaction in the database: capacity check + insert can't race.
    const { data: status, error } = await context.supabase.rpc("join_team", {
      _team_id: data.teamId,
      _note: data.note,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already requested to join this team.");
      throw new Error(error.message);
    }
    return { status: (status as string) ?? "pending" };
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
    // Approval, rejection and waitlist swaps all run atomically in the database.
    const { data: result, error } = await context.supabase.rpc("decide_membership", {
      _membership_id: data.membershipId,
      _action: data.action === "reject" ? "reject" : "approve",
      ...(data.removeMembershipId ? { _remove_membership_id: data.removeMembershipId } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true, status: result as string };
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
    const { data: deleted, error } = await context.supabase
      .from("teams")
      .delete()
      .eq("id", data.teamId)
      .eq("creator_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted?.length)
      throw new Error("You can only delete a team you created (or it no longer exists).");
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
    const { data: team } = await context.supabase
      .from("teams")
      .select("hackathon_id")
      .eq("id", teamId)
      .eq("creator_id", context.userId)
      .single();
    if (!team) throw new Error("Team not found");
    const hackathon = await getHackathonLock(context.supabase, team.hackathon_id);
    const teamSizeError = teamSizeLimitError(
      data.max_size,
      hackathon.min_team_size,
      hackathon.max_team_size,
    );
    if (teamSizeError) throw new Error(teamSizeError);
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

// ---------- admin ----------

/** Embedded to-one relations come back as an object or a single-element array
 * depending on the query planner — normalise either to the title string. */
function embeddedTitle(hackathons: unknown): string | null {
  if (!hackathons) return null;
  if (Array.isArray(hackathons)) return hackathons[0]?.title ?? null;
  return (hackathons as { title?: string | null }).title ?? null;
}

/** Owner-only: every team with its leader and full roster (all membership
 * statuses), for the admin dashboard. Uses the service-role client, so it must
 * enforce assertAdmin. */
export const adminListTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select(
        "id, name, description, max_size, needed_roles, creator_id, created_at, hackathon_id, hackathons(title)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const teamIds = (teams ?? []).map((t) => t.id);
    const memberships = teamIds.length
      ? ((
          await supabaseAdmin
            .from("team_memberships")
            .select("id, team_id, user_id, status, created_at")
            .in("team_id", teamIds)
            .order("created_at", { ascending: true })
        ).data ?? [])
      : [];

    const userIds = Array.from(
      new Set(
        [...(teams ?? []).map((t) => t.creator_id), ...memberships.map((m) => m.user_id)].filter(
          Boolean,
        ),
      ),
    ) as string[];

    const profileMap = new Map<
      string,
      { full_name: string | null; reg_number: string | null; programme: string | null }
    >();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, reg_number, programme")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, {
          full_name: p.full_name,
          reg_number: p.reg_number,
          programme: p.programme,
        });
      }
    }

    const membersByTeam = new Map<
      string,
      Array<{
        id: string;
        user_id: string;
        status: string;
        full_name: string | null;
        reg_number: string | null;
        programme: string | null;
      }>
    >();
    for (const m of memberships) {
      const profile = profileMap.get(m.user_id);
      const list = membersByTeam.get(m.team_id) ?? [];
      list.push({
        id: m.id,
        user_id: m.user_id,
        status: m.status,
        full_name: profile?.full_name ?? null,
        reg_number: profile?.reg_number ?? null,
        programme: profile?.programme ?? null,
      });
      membersByTeam.set(m.team_id, list);
    }

    return (teams ?? []).map((t) => {
      const creator = t.creator_id ? profileMap.get(t.creator_id) : undefined;
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        max_size: t.max_size,
        needed_roles: t.needed_roles ?? [],
        created_at: t.created_at,
        hackathon_id: t.hackathon_id,
        hackathon_title: embeddedTitle(t.hackathons),
        creator: {
          user_id: t.creator_id,
          full_name: creator?.full_name ?? null,
          reg_number: creator?.reg_number ?? null,
        },
        members: membersByTeam.get(t.id) ?? [],
      };
    });
  });

/** Owner-only: delete any team (cascades to its memberships). Uses the
 * service-role client to bypass the creator-scoped RLS delete policy, so it
 * must enforce assertAdmin. */
export const adminDeleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deleted, error } = await supabaseAdmin
      .from("teams")
      .delete()
      .eq("id", data.teamId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted?.length) throw new Error("Team not found (it may already be deleted).");
    return { ok: true };
  });
