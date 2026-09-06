import { db } from "@/lib/db";
import { handle } from "@/lib/api";
import { DomainError } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/restaurants/[slug]">,
) {
  return handle(async () => {
    const { slug } = await params;

    const restaurant = await db.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        isActive: true,
        isAcceptingOrders: true,
        avgPrepMinutes: true,
        packingFeeMinor: true,
        categories: {
          where: { isArchived: false },
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
                imageUrl: true,
                isVeg: true,
                isAvailable: true,
                optionGroups: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    name: true,
                    selectionType: true,
                    minSelect: true,
                    maxSelect: true,
                    options: {
                      orderBy: { sortOrder: "asc" },
                      select: {
                        id: true,
                        name: true,
                        priceDeltaMinor: true,
                        isAvailable: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!restaurant?.isActive) throw new DomainError("Restaurant not found", 404, "NOT_FOUND");
    return restaurant;
  });
}
