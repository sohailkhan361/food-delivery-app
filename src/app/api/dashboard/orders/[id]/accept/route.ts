import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { acceptOrder } from "@/lib/orders/service";

const bodySchema = z.object({ prepMinutes: z.number().int().min(5).max(120) });

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/dashboard/orders/[id]/accept">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { prepMinutes } = await parseBody(request, bodySchema);
    return acceptOrder(user, id, prepMinutes);
  });
}
