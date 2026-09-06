import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { phoneSchema } from "@/lib/contracts";

const loginSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().max(80).optional(),
});

/**
 * DEV SIGN-IN — no OTP is sent or checked. Phase 4 replaces this route with
 * Clerk's phone flow; the session cookie contract stays identical.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const { phone, name } = await parseBody(request, loginSchema);

    const user = await db.user.upsert({
      where: { phone },
      update: name ? { name } : {},
      create: { phone, name, role: "CUSTOMER" },
      select: { id: true, phone: true, name: true, role: true },
    });

    await createSession(user.id);
    return { user };
  });
}
