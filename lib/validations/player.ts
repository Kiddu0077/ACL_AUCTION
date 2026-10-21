import { z } from "zod";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const fileField = (accept: string[], label: string) =>
  z
    .custom<File>(
      (file) => typeof File !== "undefined" && file instanceof File,
      `${label} is required`,
    )
    .superRefine((file, context) => {
      // A missing or cleared file must produce a field error, not throw while
      // reading its size. Guard File as well for server-side schema consumers.
      if (typeof File === "undefined" || !(file instanceof File)) return;
      if (file.size === 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is empty` });
      }
      if (file.size > MAX_IMAGE_BYTES) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be 5MB or smaller` });
      }
      if (!accept.includes(file.type)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a JPG, PNG, WebP or HEIC image",
        });
      }
    });

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
    .max(20, "Phone number must be 20 characters or fewer")
    .regex(/^\+?[0-9][0-9 \-]*[0-9]$/, "Enter a valid phone number")
    .refine((phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }, "Enter a phone number with 7 to 15 digits"),
  city: z
    .string()
    .trim()
    .min(2, "Enter your city")
    .max(80, "City is too long"),
  profile_picture: fileField(IMAGE_TYPES, "Profile photo"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
