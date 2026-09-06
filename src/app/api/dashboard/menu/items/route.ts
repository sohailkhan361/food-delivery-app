import { db } from "@/lib/db";
import { requireUser, requireStaffFor, resolveStaffRestaurantId } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { menuItemInputSchema } from "@/lib/contracts";
import { DomainError } from "@/lib/orders/service";

export async function POST(request: Request) {
  return handle(
    async () => {
      const user = await requireUser();
      const restaurantId = await resolveStaffRestaurantId(user);
      if (!restaurantId) throw new DomainError("No restaurant linked", 404, "NOT_FOUND");
      await requireStaffFor(restaurantId);

      const input = await parseBody(request, menuItemInputSchema);

      // The category must belong to this restaurant — never trust the id.
      const category = await db.menuCategory.findFirst({
        where: { id: input.categoryId, restaurantId },
        select: { id: true },
      });
      if (!category) throw new DomainError("Category not found", 404, "NOT_FOUND");

      const { optionGroups, ...item } = input;
      return db.menuItem.create({
        data: {
          ...item,
          restaurantId,
          optionGroups: {
            create: optionGroups.map((group, gi) => ({
              name: group.name,
              selectionType: group.selectionType,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: gi,
              options: {
                create: group.options.map((option, oi) => ({
                  name: option.name,
                  priceDeltaMinor: option.priceDeltaMinor,
                  isAvailable: option.isAvailable,
                  sortOrder: oi,
                })),
              },
            })),
          },
        },
        select: { id: true, name: true, priceMinor: true, isAvailable: true },
      });
    },
    { status: 201 },
  );
}
