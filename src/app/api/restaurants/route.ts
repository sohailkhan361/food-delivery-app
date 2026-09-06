import { db } from "@/lib/db";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () =>
    db.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        imageUrl: true,
        isAcceptingOrders: true,
        avgPrepMinutes: true,
      },
    }),
  );
}
