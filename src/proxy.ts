import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16 renamed Middleware to Proxy. Same execution model, new filename.
 *
 * IMPORTANT: this is an OPTIMISTIC gate only — it keeps signed-out visitors
 * from seeing the dashboard shell. Per the Next docs, Proxy must not be the
 * authorization solution. Every dashboard read/write independently verifies
 * the caller's RestaurantStaff row in the service layer (Phase 4).
 */

// Flips on automatically once Clerk is configured, so local dev before
// Phase 4 is not blocked by a redirect loop.
const AUTH_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const SESSION_COOKIES = ["__session", "__clerk_db_jwt"];

export function proxy(request: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );

  if (!hasSession) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
