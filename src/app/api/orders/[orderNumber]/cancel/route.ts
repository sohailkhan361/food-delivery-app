import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { cancelOrder, DomainError } from "@/lib/orders/service";
import { z } from "zod";

const bodySchema = z.object({ reason: z.string().trim().max(200).optional() });

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/orders/[orderNumber]/cancel">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { orderNumber } = await params;
    const { reason } = await parseBody(request, bodySchema);

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });
    if (!order) throw new DomainError("Order not found", 404, "NOT_FOUND");

    return cancelOrder(user, order.id, reason);
  });
}
