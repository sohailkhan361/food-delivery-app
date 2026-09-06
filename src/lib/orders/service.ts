import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { requireStaffFor } from "@/lib/auth";
import type { OrderStatus, OrderType } from "@/generated/prisma/enums";
import { checkMinimumOrder, computePricing, type PricingLine } from "./pricing";
import { actorForRole, assertTransition, isTerminal } from "./status";
import { generateOrderNumber } from "./order-number";
import type { PlaceOrderInput } from "@/lib/contracts";
import { formatMoney } from "@/lib/money";

/** Domain failures the API maps straight onto HTTP status codes. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const ONLINE_PAYMENT_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_ONLINE_PAYMENT === "true";

// ------------------------------------------------------------------ place

/**
 * Everything that happens before a write: authorization of the address,
 * deliverability, live menu prices, option-group rules, and the total.
 *
 * Shared by `quoteOrder` (checkout preview) and `placeOrder` (the real
 * thing), so the number the customer is shown cannot drift from the number
 * they are charged.
 */
async function prepareOrder(user: SessionUser, input: PlaceOrderInput) {
  const restaurant = await db.restaurant.findUnique({
    where: { id: input.restaurantId },
    select: {
      id: true,
      name: true,
      isActive: true,
      isAcceptingOrders: true,
      packingFeeMinor: true,
      taxPercent: true,
      avgPrepMinutes: true,
      zones: { select: { zoneId: true } },
    },
  });
  if (!restaurant?.isActive) {
    throw new DomainError("Restaurant not found", 404, "NOT_FOUND");
  }
  if (!restaurant.isAcceptingOrders) {
    throw new DomainError(
      `${restaurant.name} is not accepting orders right now.`,
      409,
      "CLOSED",
    );
  }

  // ---- resolve delivery target
  let zone: {
    id: string;
    deliveryFeeMinor: number;
    minOrderMinor: number;
    etaMinutes: number;
  } | null = null;
  let address: Awaited<ReturnType<typeof db.address.findFirst>> = null;

  if (input.type === "DELIVERY") {
    address = await db.address.findFirst({
      where: { id: input.addressId, userId: user.id },
    });
    if (!address) throw new DomainError("Address not found", 404, "NOT_FOUND");

    const resolved = address.zoneId
      ? await db.zone.findUnique({ where: { id: address.zoneId } })
      : await db.zone.findFirst({
          where: { isActive: true, postalCodes: { has: address.postalCode } },
        });

    if (!resolved || !resolved.isActive) {
      throw new DomainError(
        "We do not deliver to this address yet.",
        409,
        "OUT_OF_ZONE",
      );
    }
    if (!restaurant.zones.some((z) => z.zoneId === resolved.id)) {
      throw new DomainError(
        `${restaurant.name} does not deliver to your area.`,
        409,
        "OUT_OF_ZONE",
      );
    }
    zone = {
      id: resolved.id,
      deliveryFeeMinor: resolved.deliveryFeeMinor,
      minOrderMinor: resolved.minOrderMinor,
      etaMinutes: resolved.etaMinutes,
    };
  }

  // ---- read the real menu; the client's prices are never consulted
  const itemIds = [...new Set(input.lines.map((l) => l.menuItemId))];
  const items = await db.menuItem.findMany({
    where: { id: { in: itemIds }, restaurantId: restaurant.id, isArchived: false },
    include: { optionGroups: { include: { options: true } } },
  });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const pricingLines: PricingLine[] = [];
  const orderItemData: {
    menuItemId: string;
    nameSnapshot: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
    note?: string;
    options: {
      optionId: string;
      groupNameSnapshot: string;
      nameSnapshot: string;
      priceDeltaMinor: number;
    }[];
  }[] = [];

  for (const line of input.lines) {
    const item = itemsById.get(line.menuItemId);
    if (!item) {
      throw new DomainError("An item in your cart is no longer available.", 409, "ITEM_GONE");
    }
    if (!item.isAvailable) {
      throw new DomainError(`${item.name} just went out of stock.`, 409, "ITEM_UNAVAILABLE");
    }

    const validOptions = new Map(
      item.optionGroups.flatMap((g) => g.options.map((o) => [o.id, { group: g, option: o }])),
    );

    const selected = line.optionIds.map((id) => {
      const match = validOptions.get(id);
      if (!match) {
        throw new DomainError(`Invalid choice for ${item.name}.`, 400, "INVALID_OPTION");
      }
      if (!match.option.isAvailable) {
        throw new DomainError(
          `${match.option.name} is unavailable for ${item.name}.`,
          409,
          "OPTION_UNAVAILABLE",
        );
      }
      return match;
    });

    // Enforce each group's min/max — the client UI can be bypassed.
    for (const group of item.optionGroups) {
      const count = selected.filter((s) => s.group.id === group.id).length;
      if (count < group.minSelect || count > group.maxSelect) {
        throw new DomainError(
          `Choose between ${group.minSelect} and ${group.maxSelect} for "${group.name}" on ${item.name}.`,
          400,
          "OPTION_COUNT",
        );
      }
    }

    const optionDeltasMinor = selected.map((s) => s.option.priceDeltaMinor);
    const pricingLine: PricingLine = {
      unitPriceMinor: item.priceMinor,
      quantity: line.quantity,
      optionDeltasMinor,
    };
    pricingLines.push(pricingLine);

    const perUnit = item.priceMinor + optionDeltasMinor.reduce((s, d) => s + d, 0);
    orderItemData.push({
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPriceMinor: item.priceMinor,
      quantity: line.quantity,
      lineTotalMinor: perUnit * line.quantity,
      note: line.note,
      options: selected.map((s) => ({
        optionId: s.option.id,
        groupNameSnapshot: s.group.name,
        nameSnapshot: s.option.name,
        priceDeltaMinor: s.option.priceDeltaMinor,
      })),
    });
  }

  // ---- the authoritative total
  const pricingContext = {
    orderType: input.type as OrderType,
    packingFeeMinor: restaurant.packingFeeMinor,
    taxPercent: restaurant.taxPercent.toString(),
    zone,
  };
  const breakdown = computePricing(pricingLines, pricingContext);

  const minimum = checkMinimumOrder(breakdown, pricingContext);
  if (!minimum.ok) {
    throw new DomainError(
      `Add ${formatMoney(minimum.shortfallMinor)} more — the minimum order for delivery is ${formatMoney(minimum.minOrderMinor)}.`,
      409,
      "BELOW_MINIMUM",
    );
  }

  return { restaurant, address, zone, breakdown, orderItemData };
}

/** Priced preview for the checkout screen. Creates nothing. */
export async function quoteOrder(user: SessionUser, input: PlaceOrderInput) {
  const { restaurant, zone, breakdown } = await prepareOrder(user, input);
  return {
    restaurantName: restaurant.name,
    etaMinutes: zone?.etaMinutes ?? restaurant.avgPrepMinutes,
    breakdown,
  };
}

export async function placeOrder(user: SessionUser, input: PlaceOrderInput) {
  if (input.paymentMethod === "ONLINE" && !ONLINE_PAYMENT_ENABLED) {
    throw new DomainError(
      "Online payment is not enabled yet — please choose cash on delivery.",
      409,
      "PAYMENT_DISABLED",
    );
  }

  // A retry of the same submit must return the original order, not a new one.
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, orderNumber: true, totalMinor: true, status: true },
  });
  if (existing) return existing;

  const { restaurant, address, breakdown, orderItemData } = await prepareOrder(
    user,
    input,
  );

  try {
    return await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          idempotencyKey: input.idempotencyKey,
          customerId: user.id,
          restaurantId: restaurant.id,
          addressId: address?.id,
          type: input.type,
          status: "PLACED",
          contactPhone: input.contactPhone,
          customerNote: input.customerNote,
          ...breakdown,
          addressSnapshot: address
            ? {
                line1: address.line1,
                line2: address.line2,
                landmark: address.landmark,
                city: address.city,
                postalCode: address.postalCode,
              }
            : undefined,
          items: {
            create: orderItemData.map((item) => ({
              menuItemId: item.menuItemId,
              nameSnapshot: item.nameSnapshot,
              unitPriceMinor: item.unitPriceMinor,
              quantity: item.quantity,
              lineTotalMinor: item.lineTotalMinor,
              note: item.note,
              options: { create: item.options },
            })),
          },
          events: {
            create: { status: "PLACED", actorId: user.id, actorRole: user.role },
          },
          payment: {
            create: {
              method: input.paymentMethod,
              provider:
                input.paymentMethod === "COD"
                  ? "cod"
                  : (process.env.PAYMENT_PROVIDER ?? "razorpay"),
              amountMinor: breakdown.totalMinor,
              status: "PENDING",
            },
          },
        },
        select: { id: true, orderNumber: true, totalMinor: true, status: true },
      });
      return order;
    });
  } catch (error) {
    // Two concurrent submits with one key: the loser reads the winner's order.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const winner = await db.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, orderNumber: true, totalMinor: true, status: true },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

// ------------------------------------------------------------- transitions

async function transition(
  orderId: string,
  to: OrderStatus,
  user: SessionUser,
  options: { note?: string; extra?: Record<string, unknown> } = {},
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, type: true, restaurantId: true, customerId: true },
  });
  if (!order) throw new DomainError("Order not found", 404, "NOT_FOUND");

  const actor = actorForRole(user.role);

  // Customers may only act on their own orders; staff only on their own restaurant's.
  if (actor === "CUSTOMER" && order.customerId !== user.id) {
    throw new DomainError("Order not found", 404, "NOT_FOUND");
  }
  if (actor === "STAFF") await requireStaffFor(order.restaurantId);

  if (isTerminal(order.status)) {
    throw new DomainError(
      `This order is already ${order.status.toLowerCase()}.`,
      409,
      "TERMINAL",
    );
  }
  assertTransition(order.status, to, actor, order.type);

  return db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: to, ...options.extra },
      select: { id: true, orderNumber: true, status: true, estimatedReadyAt: true },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: to,
        note: options.note,
        actorId: user.id,
        actorRole: user.role,
      },
    });
    // COD is settled the moment the food changes hands.
    if (to === "DELIVERED" || to === "COLLECTED") {
      await tx.payment.updateMany({
        where: { orderId: order.id, method: "COD", status: "PENDING" },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    return updated;
  });
}

export async function acceptOrder(
  user: SessionUser,
  orderId: string,
  prepMinutes: number,
) {
  return transition(orderId, "ACCEPTED", user, {
    extra: {
      prepMinutes,
      acceptedAt: new Date(),
      estimatedReadyAt: new Date(Date.now() + prepMinutes * 60_000),
    },
  });
}

export async function rejectOrder(
  user: SessionUser,
  orderId: string,
  reason: string,
) {
  return transition(orderId, "REJECTED", user, {
    note: reason,
    extra: { cancelReason: reason, cancelledAt: new Date() },
  });
}

export async function advanceOrder(
  user: SessionUser,
  orderId: string,
  to: OrderStatus,
) {
  const extra =
    to === "DELIVERED" || to === "COLLECTED" ? { deliveredAt: new Date() } : {};
  return transition(orderId, to, user, { extra });
}

export async function cancelOrder(
  user: SessionUser,
  orderId: string,
  reason?: string,
) {
  return transition(orderId, "CANCELLED", user, {
    note: reason,
    extra: { cancelReason: reason ?? "Cancelled by customer", cancelledAt: new Date() },
  });
}
