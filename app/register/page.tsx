import { redirect } from "next/navigation";
import { REGISTRATION_PATH } from "@/lib/tournament";

export default function RegisterRedirect() {
  redirect(REGISTRATION_PATH);
}
