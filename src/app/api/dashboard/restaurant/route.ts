import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireStaffFor, resolveStaffRestaurantId } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

const patchSchema = z.object({
  isAcceptingOrders: z.boolean().optional(),
  avgPrepMinutes: z.number().int().min(5).max(120).optional(),
  packingFeeMinor: z.number().int().min(0).optional(),
});

/** The merchant's panic switch, plus the two fee/time knobs they own. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const restaurantId = await resolveStaffRestaurantId(user);
    if (!restaurantId) throw new DomainError("No restaurant linked", 404, "NOT_FOUND");
    await requireStaffFor(restaurantId);

    const input = await parseBody(request, patchSchema);
    return db.restaurant.update({
      where: { id: restaurantId },
      data: input,
      select: {
        id: true,
        isAcceptingOrders: true,
        avgPrepMinutes: true,
        packingFeeMinor: true,
      },
    });
  });
}
