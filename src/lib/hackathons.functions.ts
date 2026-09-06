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

    const { data: clashes } = await supabase
      .from("hackathons")
      .select("id, title, starts_at")
      .neq("id", data.id)
      .gte("starts_at", new Date(new Date(hackathon.starts_at).getTime() - 36e5 * 12).toISOString())
      .lte("starts_at", new Date(new Date(hackathon.starts_at).getTime() + 36e5 * 12).toISOString());

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, description, max_size, needed_roles, creator_id, created_at, team_memberships(status)")
      .eq("hackathon_id", data.id)
      .order("created_at", { ascending: false });

    const { data: looking } = await supabase
      .from("looking_for_team")
      .select("id, note, created_at, user_id, profiles(full_name, reg_number, programme, skills)")
      .eq("hackathon_id", data.id)
      .order("created_at", { ascending: false });

    const shapedTeams = (teams ?? []).map((t) => {
      const memberships = (t.team_memberships ?? []) as { status: string }[];
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        max_size: t.max_size,
        needed_roles: t.needed_roles,
        created_at: t.created_at,
        member_count: memberships.filter((m) => m.status === "member").length,
        pending_count: memberships.filter((m) => m.status === "pending").length,
        waitlist_count: memberships.filter((m) => m.status === "waitlisted").length,
      };
    });

    return { hackathon, clashes: clashes ?? [], teams: shapedTeams, looking: looking ?? [] };
  });

export const getOrganizers = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select("full_name, reg_number, programme, skills, instagram, linkedin, github, avatar_url")
    .in("id", ids);
  return data ?? [];
});

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ regNumber: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, reg_number, programme, skills, instagram, linkedin, github, avatar_url, id")
      .eq("reg_number", data.regNumber.toUpperCase())
      .maybeSingle();
    if (error || !profile) throw new Error("Profile not found");

    const { data: memberships } = await supabase
      .from("team_memberships")
      .select("status, teams(name, hackathons(title, starts_at))")
      .eq("user_id", profile.id)
      .eq("status", "member");

    return { profile: { ...profile, id: undefined }, memberships: memberships ?? [] };
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
      ...data,
      suggested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- admin ----------

export const adminCreateHackathon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => hackathonInput.parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("hackathons")
      .insert({
        ...data,
        website_url: data.website_url || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
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
      .update({ ...data.patch, website_url: data.patch.website_url || null })
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
      .select("*, profiles(full_name, reg_number)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSetSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("hackathon_suggestions")
      .update({ status: data.status })
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
