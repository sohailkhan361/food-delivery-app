import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MenuList } from "@/components/shop/menu-list";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({
  params,
}: PageProps<"/restaurants/[slug]">) {
  const { slug } = await params; // Next 16: params is async.

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      isAcceptingOrders: true,
      avgPrepMinutes: true,
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

  if (!restaurant?.isActive) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="text-sm text-muted-foreground">{restaurant.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          ~{restaurant.avgPrepMinutes} min ·{" "}
          {restaurant.isAcceptingOrders ? "Accepting orders" : "Not accepting orders"}
        </p>
      </header>

      <MenuList
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          isAcceptingOrders: restaurant.isAcceptingOrders,
        }}
        categories={restaurant.categories}
      />
    </div>
  );
}
