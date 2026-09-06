import { isVitEmail } from "./constants";

// Server-side enforcement: only VIT Google accounts may use the app.
export function assertVitEmail(email: string | null | undefined) {
  if (!isVitEmail(email)) {
    throw new Error("Only VIT email accounts (@vitstudent.ac.in / @vit.ac.in) are allowed.");
  }
}

export async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string
) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}
