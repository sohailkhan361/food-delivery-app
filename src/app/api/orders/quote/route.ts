import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { placeOrderSchema } from "@/lib/contracts";
import { quoteOrder } from "@/lib/orders/service";

export const dynamic = "force-dynamic";

/**
 * Checkout asks the server what the order costs before submitting it, so the
 * displayed total and the charged total come from the same code path.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await parseBody(request, placeOrderSchema);
    return quoteOrder(user, input);
  });
}
