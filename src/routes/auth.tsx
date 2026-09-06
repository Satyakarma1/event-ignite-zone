import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { isVitEmail } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ error: (s.error as string) || "" }),
  head: () => ({ meta: [{ title: "Sign in — HackMate VIT" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { error } = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        if (!isVitEmail(session.user.email)) {
          await supabase.auth.signOut();
          toast.error("Only VIT email accounts (@vitstudent.ac.in / @vit.ac.in) are allowed.");
          return;
        }
        navigate({ to: "/dashboard" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    setLoading(false);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Zap className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Sign in to HackMate</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your VIT Google account. Only{" "}
          <span className="font-mono text-xs">@vitstudent.ac.in</span> and{" "}
          <span className="font-mono text-xs">@vit.ac.in</span> emails are accepted.
        </p>
        {error === "domain" && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            That Google account isn't a VIT email. Try again with your institute account.
          </p>
        )}
        <Button className="mt-6 w-full" size="lg" onClick={signIn} disabled={loading}>
          {loading ? "Opening Google…" : "Continue with Google"}
        </Button>
      </div>
    </div>
  );
}
