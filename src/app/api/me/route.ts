import { getSessionUser, resolveStaffRestaurantId } from "@/lib/auth";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    if (!user) return { user: null, restaurantId: null };
    const restaurantId =
      user.role === "CUSTOMER" ? null : await resolveStaffRestaurantId(user);
    return { user, restaurantId };
  });
}
