import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isVitEmail } from "./constants";

// Server-side enforcement: only VIT Google accounts may use the app.
export function assertVitEmail(email: string | null | undefined) {
  if (!isVitEmail(email)) {
    throw new Error("Only VIT email accounts (@vitstudent.ac.in / @vit.ac.in) are allowed.");
  }
}

export async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const ownerEmail = process.env["ADMIN_OWNER_EMAIL"]?.trim().toLowerCase();
  if (!ownerEmail) throw new Error("Admin owner is not configured.");
  if (email?.trim().toLowerCase() !== ownerEmail) throw new Error("Forbidden: admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: owner, error } = await supabaseAdmin
    .from("site_owner")
    .select("user_id")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (owner && owner.user_id !== userId) throw new Error("Forbidden: admin only");
  if (!owner) {
    const { error: insertError } = await supabaseAdmin
      .from("site_owner")
      .insert({ id: true, user_id: userId });
    if (insertError && insertError.code !== "23505") throw new Error(insertError.message);
  }
}
