import { z } from "zod";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const fileField = (accept: string[], label: string) =>
  z
    .custom<File>((f) => f instanceof File, `${label} is required`)
    .refine((f) => f.size > 0, `${label} is required`)
    .refine((f) => f.size <= MAX_IMAGE_BYTES, `${label} must be 5MB or smaller`)
    .refine(
      (f) => accept.includes(f.type),
      `${label} must be ${accept.join(", ")}`,
    );

export const registrationSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(120, "Name is too long"),
  role: z.enum(["Batsman", "Bowler", "All-rounder"], {
    required_error: "Select a role",
  }),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 \-]{7,20}$/, "Enter a valid phone number"),
  city: z
    .string()
    .trim()
    .min(2, "Enter your city")
    .max(80, "City is too long"),
  profile_picture: fileField(IMAGE_TYPES, "Profile photo"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
