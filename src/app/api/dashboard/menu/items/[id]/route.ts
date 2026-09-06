import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireStaffFor } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  priceMinor: z.number().int().min(1).optional(),
  isVeg: z.boolean().nullable().optional(),
  isAvailable: z.boolean().optional(),
  categoryId: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

async function loadOwnedItem(id: string) {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, restaurantId: true },
  });
  if (!item) throw new DomainError("Item not found", 404, "NOT_FOUND");
  await requireStaffFor(item.restaurantId);
  return item;
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/dashboard/menu/items/[id]">,
) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    const item = await loadOwnedItem(id);
    const input = await parseBody(request, patchSchema);

    if (input.categoryId) {
      const category = await db.menuCategory.findFirst({
        where: { id: input.categoryId, restaurantId: item.restaurantId },
        select: { id: true },
      });
      if (!category) throw new DomainError("Category not found", 404, "NOT_FOUND");
    }

    return db.menuItem.update({
      where: { id },
      data: input,
      select: { id: true, name: true, priceMinor: true, isAvailable: true },
    });
  });
}

/** Archive, never delete — existing orders still point at this row. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/dashboard/menu/items/[id]">,
) {
  return handle(async () => {
    await requireUser();
    const { id } = await params;
    await loadOwnedItem(id);
    return db.menuItem.update({
      where: { id },
      data: { isArchived: true, isAvailable: false },
      select: { id: true, isArchived: true },
    });
  });
}
