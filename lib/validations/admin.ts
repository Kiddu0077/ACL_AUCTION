import { z } from "zod";

export const MAX_DATABASE_INTEGER = 2_147_483_647;
export const positiveInteger = z.number().int().min(1).max(MAX_DATABASE_INTEGER);
export const nonnegativeInteger = z.number().int().min(0).max(MAX_DATABASE_INTEGER);

const optionalText = z.string().trim().nullable().optional();
const optionalImage = z.union([z.literal(""), z.string().url().refine((value) => /^https?:\/\//i.test(value), "Image must use an HTTP or HTTPS URL")]).nullable().optional();

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  short_name: optionalText,
  owner_name: optionalText,
  color: optionalText,
  logo_url: optionalImage,
  budget_total: positiveInteger.optional(),
  squad_size: positiveInteger.optional(),
  is_locked: z.boolean().optional(),
  pool: z.enum(["A", "B"]).nullable().optional(),
});

export const adminPlayerSchema = z.object({
  full_name: z.string().trim().min(1, "Player name is required").max(120),
  role: z.enum(["Batsman", "Bowler", "All-rounder"]),
  city: z.string().trim().min(1, "City is required").max(80),
  phone: z.string().trim().max(20).nullable().optional(),
  profile_picture_url: optionalImage,
});

export const auctionSettingsSchema = z.object({
  base_price: positiveInteger.optional(),
  bid_increment: positiveInteger.optional(),
  default_team_budget: positiveInteger.optional(),
});

export function adjustedPurse(budget: number, delta: number) {
  if (!Number.isSafeInteger(delta)) return { error: "Purse adjustment must be a whole number" };
  const next = budget + delta;
  if (!positiveInteger.safeParse(next).success) {
    return { error: "The team's total purse must remain between ₹1 and ₹2,147,483,647" };
  }
  return { error: null, budget: next };
}
