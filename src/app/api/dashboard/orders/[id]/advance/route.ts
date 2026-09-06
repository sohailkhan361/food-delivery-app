import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { advanceOrder } from "@/lib/orders/service";

const bodySchema = z.object({
  to: z.enum(["PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COLLECTED"]),
});

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/dashboard/orders/[id]/advance">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { to } = await parseBody(request, bodySchema);
    return advanceOrder(user, id, to);
  });
}
