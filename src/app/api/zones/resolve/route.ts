import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

/** Is this postal code deliverable, and at what fee? Used before checkout. */
export async function GET(request: Request) {
  return handle(async () => {
    const postalCode = new URL(request.url).searchParams.get("postalCode")?.trim();
    if (!postalCode) throw new DomainError("postalCode is required", 400, "BAD_REQUEST");

    const zone = await db.zone.findFirst({
      where: { isActive: true, postalCodes: { has: postalCode } },
      select: {
        id: true,
        name: true,
        city: true,
        deliveryFeeMinor: true,
        minOrderMinor: true,
        etaMinutes: true,
      },
    });

    return zone ? { deliverable: true as const, zone } : { deliverable: false as const, zone: null };
  });
}
