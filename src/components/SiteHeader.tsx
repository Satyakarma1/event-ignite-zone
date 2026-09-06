import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Zap, LogOut, LayoutDashboard, ShieldCheck, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/hackathons.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function SiteHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: 60_000,
  });

  const fetchProfile = useServerFn(getMyProfile);
  const fetchIsAdmin = useServerFn(isAdmin);

  const { data: profileData } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchProfile,
    enabled: !!session,
    staleTime: 60_000,
  });

  const { data: adminData } = useQuery({
    queryKey: ["is-admin"],
    queryFn: fetchIsAdmin,
    enabled: !!session,
    staleTime: 60_000,
  });

  const profile = profileData?.profile;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors hover:text-accent ${
        pathname.startsWith(to) ? "text-accent" : "text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Zap className="h-4 w-4" />
            </span>
            HackMate
            <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
              VIT
            </span>
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            {navLink("/hackathons", "Hackathons")}
            {session && navLink("/dashboard", "My Teams")}
            {session && navLink("/suggest", "Suggest")}
          </nav>
        </div>

        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none ring-ring focus-visible:ring-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {(profile?.full_name || session.email || "V").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {profile?.reg_number && (
                <DropdownMenuItem onClick={() => navigate({ to: "/u/$regNo", params: { regNo: profile.reg_number! } })}>
                  <User className="mr-2 h-4 w-4" /> My profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </DropdownMenuItem>
              {adminData?.isAdmin && (
                <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
