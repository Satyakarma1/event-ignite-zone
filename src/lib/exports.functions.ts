import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertVitEmail } from "./authz.server";
import { toCsv } from "./csv.utils";

function hackathonTitle(hackathons: unknown): string | null {
  if (!hackathons) return null;
  if (Array.isArray(hackathons)) {
    return hackathons[0]?.title ?? null;
  }
  return (hackathons as { title?: string | null }).title ?? null;
}

export const exportUsersCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, reg_number, programme, skills, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      reg_number: p.reg_number,
      programme: p.programme,
      skills: (p.skills ?? []).join("; "),
      email: p.email,
      phone: p.phone,
      created_at: p.created_at,
    }));
    return toCsv(
      ["id", "full_name", "reg_number", "programme", "skills", "email", "phone", "created_at"],
      rows,
    );
  });

export const exportTeamsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select(
        "id, name, description, max_size, needed_roles, whatsapp_link, creator_id, created_at, hackathons(title)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const creatorIds = (teams ?? []).map((t) => t.creator_id).filter(Boolean) as string[];
    const profileMap = new Map<string, { reg_number: string | null; full_name: string | null }>();
    if (creatorIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, reg_number, full_name")
        .in("id", creatorIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { reg_number: p.reg_number, full_name: p.full_name });
      }
    }

    const rows = (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      hackathon_title: hackathonTitle(t.hackathons),
      max_size: t.max_size,
      needed_roles: (t.needed_roles ?? []).join("; "),
      whatsapp_link: t.whatsapp_link,
      creator_reg_number: profileMap.get(t.creator_id)?.reg_number ?? "",
      creator_name: profileMap.get(t.creator_id)?.full_name ?? "",
      created_at: t.created_at,
    }));
    return toCsv(
      [
        "id",
        "name",
        "description",
        "hackathon_title",
        "max_size",
        "needed_roles",
        "whatsapp_link",
        "creator_reg_number",
        "creator_name",
        "created_at",
      ],
      rows,
    );
  });

export const exportMembershipsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: memberships, error } = await supabaseAdmin
      .from("team_memberships")
      .select("id, team_id, user_id, status, note, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = (memberships ?? []).map((m) => m.user_id).filter(Boolean) as string[];
    const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean) as string[];

    const profileMap = new Map<string, { reg_number: string | null; full_name: string | null }>();
    const teamMap = new Map<string, { name: string | null }>();

    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, reg_number, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { reg_number: p.reg_number, full_name: p.full_name });
      }
    }

    if (teamIds.length) {
      const { data: teams } = await supabaseAdmin
        .from("teams")
        .select("id, name")
        .in("id", teamIds);
      for (const t of teams ?? []) {
        teamMap.set(t.id, { name: t.name });
      }
    }

    const rows = (memberships ?? []).map((m) => ({
      id: m.id,
      team_name: teamMap.get(m.team_id)?.name ?? "",
      member_reg_number: profileMap.get(m.user_id)?.reg_number ?? "",
      member_name: profileMap.get(m.user_id)?.full_name ?? "",
      status: m.status,
      note: m.note,
      created_at: m.created_at,
    }));
    return toCsv(
      ["id", "team_name", "member_reg_number", "member_name", "status", "note", "created_at"],
      rows,
    );
  });

export const exportSuggestionsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    await assertAdmin(context.supabase, context.userId, context.claims.email as string);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: suggestions, error } = await supabaseAdmin
      .from("hackathon_suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = (suggestions ?? [])
      .map((s) => s.suggested_by)
      .filter((id): id is string => Boolean(id));
    const profileMap = new Map<string, { reg_number: string | null; full_name: string | null }>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, reg_number, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { reg_number: p.reg_number, full_name: p.full_name });
      }
    }

    const rows = (suggestions ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      event_date: s.event_date,
      fee: s.fee,
      website_url: s.website_url,
      status: s.status,
      suggested_by_reg_number: s.suggested_by
        ? (profileMap.get(s.suggested_by)?.reg_number ?? "")
        : "",
      suggested_by_name: s.suggested_by ? (profileMap.get(s.suggested_by)?.full_name ?? "") : "",
      created_at: s.created_at,
    }));
    return toCsv(
      [
        "id",
        "title",
        "description",
        "event_date",
        "fee",
        "website_url",
        "status",
        "suggested_by_reg_number",
        "suggested_by_name",
        "created_at",
      ],
      rows,
    );
  });
