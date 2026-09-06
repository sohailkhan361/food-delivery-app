import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { rejectOrder } from "@/lib/orders/service";

const bodySchema = z.object({ reason: z.string().trim().min(3).max(200) });

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/dashboard/orders/[id]/reject">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { reason } = await parseBody(request, bodySchema);
    return rejectOrder(user, id, reason);
  });
}
