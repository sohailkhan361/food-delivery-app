import { db } from "@/lib/db";
import { requireUser, requireStaffFor, resolveStaffRestaurantId } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { categoryInputSchema } from "@/lib/contracts";
import { DomainError } from "@/lib/orders/service";

export async function POST(request: Request) {
  return handle(
    async () => {
      const user = await requireUser();
      const restaurantId = await resolveStaffRestaurantId(user);
      if (!restaurantId) throw new DomainError("No restaurant linked", 404, "NOT_FOUND");
      await requireStaffFor(restaurantId);

      const input = await parseBody(request, categoryInputSchema);
      return db.menuCategory.create({
        data: { ...input, restaurantId },
        select: { id: true, name: true, sortOrder: true },
      });
    },
    { status: 201 },
  );
}
