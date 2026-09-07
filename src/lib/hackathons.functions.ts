import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./public.server";
import { assertAdmin, assertVitEmail } from "./authz.server";

const hackathonInput = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(""),
  starts_at: z.string().min(4),
  ends_at: z.string().nullish(),
  registration_deadline: z.string().nullish(),
  fee: z.number().int().min(0).default(0),
  website_url: z.string().trim().url().nullish().or(z.literal("")),
  venue: z.string().trim().max(200).nullish(),
  organizer_club: z.string().trim().max(200).nullish(),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
});

type HackathonInput = z.infer<typeof hackathonInput>;

function normalizeHackathon(input: HackathonInput) {
  return {
    title: input.title,
    description: input.description,
    starts_at: input.starts_at,
    ends_at: input.ends_at || null,
    registration_deadline: input.registration_deadline || null,
    fee: input.fee,
    website_url: input.website_url || null,
    venue: input.venue || null,
    organizer_club: input.organizer_club || null,
    tags: input.tags,
  };
}

// ---------- public reads ----------

export const listHackathons = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("hackathons")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getHackathon = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: hackathon, error } = await supabase
      .from("hackathons")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !hackathon) throw new Error("Hackathon not found");

    const windowMs = 36e5 * 12;
    const startedAt = new Date(hackathon.starts_at).getTime();

    const [clashesRes, teamsRes, lookingRes] = await Promise.all([
      supabase
        .from("hackathons")
        .select("id, title, starts_at")
        .neq("id", data.id)
        .gte("starts_at", new Date(startedAt - windowMs).toISOString())
        .lte("starts_at", new Date(startedAt + windowMs).toISOString()),
      supabase
        .from("teams")
        .select("id, name, description, max_size, needed_roles, created_at")
        .eq("hackathon_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("looking_for_team")
        .select("id, note, created_at, user_id")
        .eq("hackathon_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    const teams = teamsRes.data ?? [];
    const teamIds = teams.map((t) => t.id);

    // Only confirmed members are publicly visible.
    const { data: memberRows } = teamIds.length
      ? await supabase.from("public_team_members").select("team_id").in("team_id", teamIds)
      : { data: [] as { team_id: string | null }[] };

    const counts = new Map<string, number>();
    for (const row of memberRows ?? []) {
      if (!row.team_id) continue;
      counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
    }

    const shapedTeams = teams.map((t) => ({
      ...t,
      member_count: counts.get(t.id) ?? 0,
    }));

    // Attach safe profile fields to the "looking for team" board.
    const looking = lookingRes.data ?? [];
    const lookingIds = looking.map((l) => l.user_id);
    const { data: lookingProfiles } = lookingIds.length
      ? await supabase
          .from("public_profiles")
          .select("id, full_name, reg_number, programme, skills")
          .in("id", lookingIds)
      : { data: [] as Array<Record<string, unknown>> };

    const profileById = new Map(
      (lookingProfiles ?? []).map((p) => [p["id"] as string, p])
    );

    const shapedLooking = looking.map((l) => ({
      id: l.id,
      note: l.note,
      created_at: l.created_at,
      profile: profileById.get(l.user_id) ?? null,
    }));

    return { hackathon, clashes: clashesRes.data ?? [], teams: shapedTeams, looking: shapedLooking };
  });

export const getOrganizers = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("public_organizers")
    .select("full_name, reg_number, programme, skills, instagram, linkedin, github, avatar_url");
  return data ?? [];
});

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ regNumber: z.string().trim().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: profile, error } = await supabase
      .from("public_profiles")
      .select("id, full_name, reg_number, programme, skills, instagram, linkedin, github, avatar_url")
      .eq("reg_number", data.regNumber.toUpperCase())
      .maybeSingle();
    if (error || !profile) throw new Error("Profile not found");

    const { data: memberships } = await supabase
      .from("public_team_members")
      .select("team_id")
      .eq("user_id", profile.id!);

    const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean) as string[];
    const { data: teams } = teamIds.length
      ? await supabase
          .from("teams")
          .select("id, name, hackathons(id, title, starts_at)")
          .in("id", teamIds)
      : { data: [] as Array<Record<string, unknown>> };

    const { id: _id, ...safeProfile } = profile;
    return { profile: safeProfile, teams: teams ?? [] };
  });

// ---------- user actions ----------

export const suggestHackathon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(2000).default(""),
        event_date: z.string().trim().max(100).default(""),
        fee: z.string().trim().max(50).default(""),
        website_url: z.string().trim().url().nullish().or(z.literal("")),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase.from("hackathon_suggestions").insert({
      title: data.title,
      description: data.description,
      event_date: data.event_date || null,
      fee: data.fee || null,
      website_url: data.website_url || null,
      suggested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- admin ----------

export const adminCreateHackathon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ hackathon: hackathonInput, fromSuggestionId: z.string().uuid().nullish() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("hackathons")
      .insert({ ...normalizeHackathon(data.hackathon), created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.fromSuggestionId) {
      await context.supabase
        .from("hackathon_suggestions")
        .update({ status: "approved", published_hackathon_id: row.id })
        .eq("id", data.fromSuggestionId);
    }
    return row;
  });

export const adminUpdateHackathon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), patch: hackathonInput }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("hackathons")
      .update(normalizeHackathon(data.patch))
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteHackathon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("hackathons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("hackathon_suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRejectSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("hackathon_suggestions")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const [users, hackathons, teams, pending] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("hackathons").select("id", { count: "exact", head: true }),
      context.supabase.from("teams").select("id", { count: "exact", head: true }),
      context.supabase
        .from("hackathon_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    return {
      users: users.count ?? 0,
      hackathons: hackathons.count ?? 0,
      teams: teams.count ?? 0,
      pendingSuggestions: pending.count ?? 0,
    };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });
