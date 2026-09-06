import Link from "next/link";
import { db } from "@/lib/db";

// Reads live data on every request. Revisit caching once there is traffic.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const restaurants = await db.restaurant.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      isAcceptingOrders: true,
      avgPrepMinutes: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
        <p className="text-sm text-muted-foreground">
          {restaurants.length} open near you
        </p>
      </div>

      {restaurants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No restaurants yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run <code className="font-mono">npm run db:seed</code> to load sample data.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link
                href={`/restaurants/${r.slug}`}
                className="block rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{r.name}</span>
                  {!r.isAcceptingOrders && (
                    <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Closed
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  ~{r.avgPrepMinutes} min
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
