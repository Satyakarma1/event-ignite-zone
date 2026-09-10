import type { Tables } from "@/integrations/supabase/types";

export type ProfileForm = {
  full_name: string;
  reg_number: string;
  programme: string;
  phone: string;
  skills: string;
  instagram: string;
  linkedin: string;
  github: string;
  avatar_url: string;
};

export function profileToForm(
  profile: Partial<Tables<"profiles">> | null | undefined,
): ProfileForm {
  return {
    full_name: profile?.full_name ?? "",
    reg_number: profile?.reg_number ?? "",
    programme: profile?.programme ?? "",
    phone: profile?.phone ?? "",
    skills: (profile?.skills ?? []).join(", "),
    instagram: profile?.instagram ?? "",
    linkedin: profile?.linkedin ?? "",
    github: profile?.github ?? "",
    avatar_url: profile?.avatar_url ?? "",
  };
}

export function suggestionStatusLabel(status: string): string {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
}
