import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { StaffRole, UserRole } from "@/generated/prisma/enums";

/**
 * Dev-grade session: an HMAC-signed httpOnly cookie holding the user id.
 *
 * Deliberately small and swappable. Phase 4 replaces `getSessionUser` with
 * Clerk (phone OTP) — every caller below keeps working, because nothing else
 * in the codebase reads the cookie directly.
 *
 * Not production auth: there is no OTP verification, so anyone who knows a
 * phone number can sign in. Do not deploy this as-is.
 */

const COOKIE = "fd_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return value;
}

function sign(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("hex");
}

function verify(userId: string, signature: string): boolean {
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies(); // Next 16: cookies() is async.
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator < 1) return null;

  const userId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!verify(userId, signature)) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, name: true, role: true, isBlocked: true },
  });
  if (!user || user.isBlocked) return null;

  const { isBlocked: _ignored, ...sessionUser } = user;
  return sessionUser;
}

// ------------------------------------------------------------------ guards

export class UnauthorizedError extends Error {
  constructor(message = "Sign in to continue") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}

/**
 * Authorization is enforced HERE, in the data layer — never in proxy.ts.
 * Admins pass for any restaurant; staff must hold a RestaurantStaff row.
 */
export async function requireStaffFor(
  restaurantId: string,
): Promise<{ user: SessionUser; staffRole: StaffRole | null }> {
  const user = await requireUser();
  if (user.role === "ADMIN") return { user, staffRole: null };

  const staff = await db.restaurantStaff.findUnique({
    where: { userId_restaurantId: { userId: user.id, restaurantId } },
    select: { role: true },
  });
  if (!staff) throw new ForbiddenError();
  return { user, staffRole: staff.role };
}

/** The restaurant this staff member works at — the dashboard's default scope. */
export async function resolveStaffRestaurantId(
  user: SessionUser,
): Promise<string | null> {
  if (user.role === "ADMIN") {
    const first = await db.restaurant.findFirst({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }
  const staff = await db.restaurantStaff.findFirst({
    where: { userId: user.id },
    select: { restaurantId: true },
  });
  return staff?.restaurantId ?? null;
}
