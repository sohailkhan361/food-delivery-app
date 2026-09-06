import { db } from "@/lib/db";
import { requireUser, resolveStaffRestaurantId } from "@/lib/auth";
import { handle } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

/** The merchant's own menu, including archived-out items' availability state. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (user.role === "CUSTOMER") throw new DomainError("Not a merchant account", 403, "FORBIDDEN");

    const restaurantId = await resolveStaffRestaurantId(user);
    if (!restaurantId) throw new DomainError("No restaurant linked to this account", 404, "NOT_FOUND");

    const [restaurant, categories] = await Promise.all([
      db.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          slug: true,
          isAcceptingOrders: true,
          avgPrepMinutes: true,
          packingFeeMinor: true,
        },
      }),
      db.menuCategory.findMany({
        where: { restaurantId, isArchived: false },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          items: {
            where: { isArchived: false },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              priceMinor: true,
              isVeg: true,
              isAvailable: true,
            },
          },
        },
      }),
    ]);

    return { restaurant, categories };
  });
}
