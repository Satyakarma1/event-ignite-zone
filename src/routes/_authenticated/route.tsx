import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isVitEmail } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (!isVitEmail(data.user.email)) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { error: "domain" } });
    }
    // Enforce onboarding (reg number) everywhere except the onboarding page itself
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("reg_number")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile?.reg_number) throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
