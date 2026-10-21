/** Keep login destinations inside the authenticated admin area. */
export function getAdminDestination(next: string | null): string {
  const fallback = "/admin/dashboard";
  if (!next || !next.startsWith("/admin/") || /[\\\u0000-\u0020]/.test(next)) {
    return fallback;
  }

  const url = new URL(next, "https://admin.invalid");
  if (
    url.origin !== "https://admin.invalid" ||
    !url.pathname.startsWith("/admin/") ||
    url.pathname === "/admin/login" ||
    url.pathname.startsWith("/admin/login/")
  ) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
