import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, parseBody } from "@/lib/api";
import { addressInputSchema } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return db.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: {
        zone: { select: { id: true, name: true, deliveryFeeMinor: true, minOrderMinor: true } },
      },
    });
  });
}

export async function POST(request: Request) {
  return handle(
    async () => {
      const user = await requireUser();
      const input = await parseBody(request, addressInputSchema);

      // Resolve the zone once, at save time, so checkout never guesses.
      const zone = await db.zone.findFirst({
        where: { isActive: true, postalCodes: { has: input.postalCode } },
        select: { id: true },
      });

      return db.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.address.updateMany({
            where: { userId: user.id },
            data: { isDefault: false },
          });
        }
        return tx.address.create({
          data: { ...input, userId: user.id, zoneId: zone?.id },
        });
      });
    },
    { status: 201 },
  );
}
