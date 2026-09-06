import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertVitEmail } from "./authz.server";
import { REG_NUMBER_REGEX } from "./constants";

const profileInput = z.object({
  full_name: z.string().trim().min(2).max(100),
  programme: z.string().trim().max(100).default(""),
  skills: z.array(z.string().trim().max(40)).max(15).default([]),
  instagram: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => value || null),
  linkedin: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => value || null),
  github: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) => value || null),
  avatar_url: z
    .string()
    .trim()
    .url()
    .nullish()
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertVitEmail(context.claims.email as string);
    const { data } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    return { profile: data ?? null, email: context.claims.email as string };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    profileInput
      .extend({
        reg_number: z
          .string()
          .trim()
          .toUpperCase()
          .regex(
            REG_NUMBER_REGEX,
            "Format must be like 25BCE2129 (year 20-26, programme code, 4 digits)",
          ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase.from("profiles").update(data).eq("id", context.userId);
    if (error) {
      if (error.code === "23505") throw new Error("That registration number is already in use.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.parse(d))
  .handler(async ({ data, context }) => {
    assertVitEmail(context.claims.email as string);
    const { error } = await context.supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
