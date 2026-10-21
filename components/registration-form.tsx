"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Camera, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/browser";
import { TOURNAMENT_NAME } from "@/lib/tournament";
import { registrationSchema, type RegistrationInput } from "@/lib/validations/player";
import { preparePlayerPhoto } from "@/lib/prepare-player-photo";

const inputClass = "mt-2 h-12 rounded-xl border-[#12352b]/20 bg-white text-[#12352b] placeholder:text-[#12352b]/40 focus-visible:ring-[#467447]";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-xs text-red-700">{message}</p>;
}

export function RegistrationForm() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [submissionStage, setSubmissionStage] = React.useState("Submitting…");
  const submissionRunning = React.useRef(false);
  // Reuse a successful upload if a subsequent insert needs to be retried.
  const uploadedProfile = React.useRef<{ file: File; playerId: string; publicUrl: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
    defaultValues: { full_name: "", phone: "", city: "" },
  });

  const profilePicture = watch("profile_picture");

  function reportDuplicate() {
    setError("phone", { type: "server", message: "This phone number is already registered." }, { shouldFocus: true });
    toast({
      variant: "destructive",
      title: "This phone number is already registered",
      description: "Each player can register only once. Contact the organisers if you need to update your details.",
    });
  }

  async function onSubmit(values: RegistrationInput) {
    if (submissionRunning.current) return;
    submissionRunning.current = true;
    setSubmissionError(null);

    try {
      const supabase = createClient();
      setSubmissionStage("Checking registration…");
      const { data: phoneTaken, error: phoneCheckErr } = await supabase.rpc("phone_exists", { p_phone: values.phone });
      if (phoneCheckErr) throw new Error(phoneCheckErr.message);
      if (phoneTaken) {
        reportDuplicate();
        return;
      }

      let profile = uploadedProfile.current;
      if (!profile || profile.file !== values.profile_picture) {
        setSubmissionStage("Preparing photo…");
        const photo = await preparePlayerPhoto(values.profile_picture);
        setSubmissionStage("Uploading photo…");
        const playerId = crypto.randomUUID();
        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type.split("/")[1];
        const profileKey = `${playerId}/profile.${extension}`;
        const { error: profileErr } = await supabase.storage.from("profile-pictures").upload(profileKey, photo, {
          contentType: photo.type,
          upsert: false,
        });
        if (profileErr) throw new Error(`Profile upload: ${profileErr.message}`);

        const { data } = supabase.storage.from("profile-pictures").getPublicUrl(profileKey);
        profile = { file: values.profile_picture, playerId, publicUrl: data.publicUrl };
        uploadedProfile.current = profile;
      }

      setSubmissionStage("Saving registration…");
      const { error: insertErr } = await supabase.from("players").insert({
        id: profile.playerId,
        full_name: values.full_name,
        role: values.role,
        phone: values.phone,
        city: values.city,
        profile_picture_url: profile.publicUrl,
        // Payment details are recorded by admins after the auction.
        status: "Pending",
      });
      if (insertErr) {
        if (insertErr.code === "23505" && /phone/i.test(insertErr.message)) {
          reportDuplicate();
          return;
        }
        throw new Error(insertErr.message);
      }

      uploadedProfile.current = null;
      toast({ variant: "success", title: "Registration submitted", description: "Your details have been received for review." });
      setSubmitted(true);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please check your connection and try again.";
      setSubmissionError(message);
      toast({ variant: "destructive", title: "Could not submit registration", description: message });
    } finally {
      submissionRunning.current = false;
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" role="status" aria-live="polite">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#d8ef87]">
          <CheckCircle2 className="h-10 w-10 text-[#12352b]" aria-hidden="true" />
        </span>
        <h3 className="text-2xl font-bold tracking-tight">You’re on the list!</h3>
        <p className="max-w-sm text-sm leading-relaxed text-[#12352b]/70">
          Your {TOURNAMENT_NAME} registration has been received and is pending review.
        </p>
        <Button asChild className="mt-2 w-full rounded-xl bg-[#12352b] text-white hover:bg-[#204d3e]">
          <Link href="/players">View players <ArrowRight aria-hidden="true" /></Link>
        </Button>
        <Button type="button" variant="outline" className="w-full rounded-xl border-[#12352b]/20 bg-white text-[#12352b] hover:bg-[#f4f2e8]" onClick={() => setSubmitted(false)}>
          Register another player
        </Button>
        <Link href="/" className="text-sm font-medium underline underline-offset-4">Back to home</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        <legend className="sr-only">Player details</legend>
        <div>
          <Label htmlFor="full_name" className="text-[#12352b]">Full name</Label>
          <Input id="full_name" autoComplete="name" placeholder="Your full name" className={inputClass} aria-required="true" aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? "full_name-error" : undefined} {...register("full_name")} />
          <FieldError id="full_name-error" message={errors.full_name?.message} />
        </div>

        <div>
          <Label htmlFor="role" className="text-[#12352b]">Playing role</Label>
          <Controller name="role" control={control} render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger id="role" ref={field.ref} onBlur={field.onBlur} className={inputClass} aria-required="true" aria-invalid={!!errors.role} aria-describedby={errors.role ? "role-error" : undefined}>
                <SelectValue placeholder="Choose your playing role" />
              </SelectTrigger>
              <SelectContent className="border-[#12352b]/15 bg-[#fffef9] text-[#12352b]">
                <SelectItem value="Batsman">Batsman</SelectItem>
                <SelectItem value="Bowler">Bowler</SelectItem>
                <SelectItem value="All-rounder">All-rounder</SelectItem>
              </SelectContent>
            </Select>
          )} />
          <FieldError id="role-error" message={errors.role?.message} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone" className="text-[#12352b]">Phone number</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" className={inputClass} aria-required="true" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} {...register("phone")} />
            <FieldError id="phone-error" message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="city" className="text-[#12352b]">City</Label>
            <Input id="city" autoComplete="address-level2" placeholder="Your city or town" className={inputClass} aria-required="true" aria-invalid={!!errors.city} aria-describedby={errors.city ? "city-error" : undefined} {...register("city")} />
            <FieldError id="city-error" message={errors.city?.message} />
          </div>
        </div>

        <div>
          <Label htmlFor="profile_picture" className="text-[#12352b]">Player photo</Label>
          <div className="mt-2 rounded-xl border border-dashed border-[#12352b]/25 bg-[#f4f2e8]/60 p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#12352b]/70"><Camera className="h-5 w-5" aria-hidden="true" /></span>
              <p id="photo-hint" className="text-xs leading-relaxed text-[#12352b]/65">A clear photo for your player profile.<br />JPG, PNG or WebP · up to 5 MB. HEIC works in supported browsers.</p>
            </div>
            <Controller name="profile_picture" control={control} render={({ field }) => (
              <Input id="profile_picture" type="file" name={field.name} ref={field.ref} onBlur={field.onBlur} accept="image/jpeg,image/png,image/webp,image/heic" className="h-auto min-h-11 rounded-lg border-[#12352b]/15 bg-white text-sm text-[#12352b] file:mr-3 file:rounded-md file:bg-[#12352b] file:px-3 file:py-1 file:text-xs file:text-white" aria-required="true" aria-invalid={!!errors.profile_picture} aria-describedby={`photo-hint${errors.profile_picture ? " photo-error" : ""}`} onChange={(event) => field.onChange(event.target.files?.[0])} />
            )} />
            {profilePicture && <p className="mt-2 break-all text-xs text-[#12352b]/65">{profilePicture.name} · {(profilePicture.size / 1024).toFixed(0)} KB</p>}
          </div>
          <FieldError id="photo-error" message={errors.profile_picture?.message} />
        </div>
      </fieldset>

      {submissionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Could not submit: {submissionError}</p>}

      <Button type="submit" size="lg" className="h-14 w-full rounded-xl bg-[#12352b] text-base font-bold text-[#d8ef87] hover:bg-[#204d3e]" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? submissionStage : "Submit registration"}
        {!isSubmitting && <ArrowRight aria-hidden="true" />}
      </Button>
      <p className="text-center text-xs leading-relaxed text-[#12352b]/55">Your details go to the tournament organisers for review.</p>
    </form>
  );
}
