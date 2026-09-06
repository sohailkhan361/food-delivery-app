import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireStaffFor } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

const bodySchema = z.object({ isAvailable: z.boolean() });

/**
 * The highest-frequency merchant write there is — an item sells out mid-
 * service and has to disappear from the customer menu immediately.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/dashboard/menu/items/[id]/availability">,
) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;

    const item = await db.menuItem.findUnique({
      where: { id },
      select: { id: true, restaurantId: true },
    });
    if (!item) throw new DomainError("Item not found", 404, "NOT_FOUND");
    await requireStaffFor(item.restaurantId);

    const { isAvailable } = await parseBody(request, bodySchema);
    return db.menuItem.update({
      where: { id },
      data: { isAvailable },
      select: { id: true, isAvailable: true },
    });
  });
}
