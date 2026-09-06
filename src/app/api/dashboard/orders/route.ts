import { db } from "@/lib/db";
import { requireUser, resolveStaffRestaurantId } from "@/lib/auth";
import { handle } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";
import { ACTIVE_STATUSES } from "@/lib/orders/status";

export const dynamic = "force-dynamic";

/**
 * The merchant queue. Polled every ~10s by the dashboard; swap for a
 * websocket/Ably channel when merchants complain about the lag.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    if (user.role === "CUSTOMER") throw new DomainError("Not a merchant account", 403, "FORBIDDEN");

    const restaurantId = await resolveStaffRestaurantId(user);
    if (!restaurantId) throw new DomainError("No restaurant linked to this account", 404, "NOT_FOUND");

    const scope = new URL(request.url).searchParams.get("scope") ?? "active";

    const orders = await db.order.findMany({
      where: {
        restaurantId,
        ...(scope === "active"
          ? { status: { in: ACTIVE_STATUSES } }
          : { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      },
      orderBy: { createdAt: scope === "active" ? "asc" : "desc" },
      take: 100,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        type: true,
        totalMinor: true,
        prepMinutes: true,
        estimatedReadyAt: true,
        contactPhone: true,
        customerNote: true,
        createdAt: true,
        addressSnapshot: true,
        payment: { select: { method: true, status: true } },
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            note: true,
            options: { select: { id: true, nameSnapshot: true } },
          },
        },
      },
    });

    return { restaurantId, orders };
  });
}
