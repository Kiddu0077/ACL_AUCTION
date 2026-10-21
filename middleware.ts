import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Public pages do not need an authenticated session. Keep every admin
  // request (including Server Actions and prefetches) protected.
  matcher: ["/admin/:path*"],
};
