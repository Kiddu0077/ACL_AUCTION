import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
          headers: Record<string, string>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );

  // Verifies the signature and expiry using cached public signing keys.
  // Supabase falls back to server verification for symmetric signing keys.
  const { data, error } = await supabase.auth.getClaims().catch(() => ({
    data: null,
    error: true,
  }));
  const authenticated = !error && Boolean(data?.claims.sub);

  // Gate /admin routes (except the login page) behind authentication.
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLoginRoute = pathname === "/admin/login";

  function redirectWithSession(url: URL) {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirect.headers.set(name, value);
    }
    return redirect;
  }

  if (isAdminRoute && !isLoginRoute && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return redirectWithSession(url);
  }

  if (isLoginRoute && authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return redirectWithSession(url);
  }

  return response;
}
