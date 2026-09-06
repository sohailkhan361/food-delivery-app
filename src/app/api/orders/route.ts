import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { placeOrderSchema } from "@/lib/contracts";
import { placeOrder } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

/** Customer's order history. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return db.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        orderNumber: true,
        status: true,
        type: true,
        totalMinor: true,
        createdAt: true,
        restaurant: { select: { name: true, slug: true } },
        items: { select: { id: true, nameSnapshot: true, quantity: true } },
      },
    });
  });
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const user = await requireUser();
      const input = await parseBody(request, placeOrderSchema);
      return placeOrder(user, input);
    },
    { status: 201 },
  );
}
