import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/orders/[orderNumber]">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { orderNumber } = await params;

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        type: true,
        subtotalMinor: true,
        packingFeeMinor: true,
        deliveryFeeMinor: true,
        taxMinor: true,
        discountMinor: true,
        totalMinor: true,
        customerId: true,
        restaurantId: true,
        contactPhone: true,
        customerNote: true,
        cancelReason: true,
        estimatedReadyAt: true,
        createdAt: true,
        addressSnapshot: true,
        restaurant: { select: { name: true, slug: true, phone: true } },
        payment: { select: { method: true, status: true } },
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            unitPriceMinor: true,
            lineTotalMinor: true,
            note: true,
            options: { select: { id: true, nameSnapshot: true, priceDeltaMinor: true } },
          },
        },
        events: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, note: true, createdAt: true },
        },
      },
    });

    if (!order) throw new DomainError("Order not found", 404, "NOT_FOUND");

    // Customers see only their own orders; staff and admins see their restaurant's.
    if (order.customerId !== user.id) {
      if (user.role === "CUSTOMER") throw new DomainError("Order not found", 404, "NOT_FOUND");
      if (user.role === "RESTAURANT_STAFF") {
        const staff = await db.restaurantStaff.findUnique({
          where: {
            userId_restaurantId: { userId: user.id, restaurantId: order.restaurantId },
          },
          select: { id: true },
        });
        if (!staff) throw new DomainError("Order not found", 404, "NOT_FOUND");
      }
    }

    const { customerId: _c, restaurantId: _r, ...safe } = order;
    return safe;
  });
}
