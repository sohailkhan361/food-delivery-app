import type { OrderType } from "@/generated/prisma/enums";
import { percentOfMinor } from "@/lib/money";

/**
 * The ONLY place an order total is computed.
 *
 * Pure and dependency-free on purpose: the client may call it to render an
 * optimistic cart, but the server recomputes it at checkout and the server's
 * number is the one that is charged. A client-supplied total is never trusted.
 */

export type PricingLine = {
  unitPriceMinor: number;
  quantity: number;
  /** Per-unit add-on deltas (extra cheese, large size, ...). */
  optionDeltasMinor?: number[];
};

export type PricingContext = {
  orderType: OrderType;
  packingFeeMinor: number;
  taxPercent: number | string;
  /** Required for DELIVERY, ignored for PICKUP. */
  zone?: { deliveryFeeMinor: number; minOrderMinor: number } | null;
  discountMinor?: number;
};

export type PriceBreakdown = {
  subtotalMinor: number;
  packingFeeMinor: number;
  deliveryFeeMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
};

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export function lineTotalMinor(line: PricingLine): number {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new PricingError(`Invalid quantity: ${line.quantity}`);
  }
  const perUnit =
    line.unitPriceMinor +
    (line.optionDeltasMinor ?? []).reduce((sum, d) => sum + d, 0);
  if (perUnit < 0) throw new PricingError("Negative unit price after options");
  return perUnit * line.quantity;
}

export function computePricing(
  lines: PricingLine[],
  ctx: PricingContext,
): PriceBreakdown {
  if (lines.length === 0) throw new PricingError("Cannot price an empty cart");

  const subtotalMinor = lines.reduce((sum, l) => sum + lineTotalMinor(l), 0);

  // A discount can never exceed the goods it discounts.
  const discountMinor = Math.min(
    Math.max(ctx.discountMinor ?? 0, 0),
    subtotalMinor,
  );

  const isDelivery = ctx.orderType === "DELIVERY";
  if (isDelivery && !ctx.zone) {
    throw new PricingError("Delivery order has no resolved zone");
  }
  const deliveryFeeMinor = isDelivery ? (ctx.zone?.deliveryFeeMinor ?? 0) : 0;
  const packingFeeMinor = Math.max(ctx.packingFeeMinor, 0);

  // Tax applies to goods (net of discount) plus packing, not to the
  // delivery fee. Confirm this against local rules before launch.
  const taxableMinor = subtotalMinor - discountMinor + packingFeeMinor;
  const taxMinor = percentOfMinor(taxableMinor, ctx.taxPercent);

  const totalMinor =
    subtotalMinor - discountMinor + packingFeeMinor + taxMinor + deliveryFeeMinor;

  return {
    subtotalMinor,
    packingFeeMinor,
    deliveryFeeMinor,
    taxMinor,
    discountMinor,
    totalMinor,
  };
}

export type MinimumOrderCheck =
  | { ok: true }
  | { ok: false; shortfallMinor: number; minOrderMinor: number };

/** Minimum-order rules apply to goods only, never to fees. */
export function checkMinimumOrder(
  breakdown: PriceBreakdown,
  ctx: PricingContext,
): MinimumOrderCheck {
  if (ctx.orderType === "PICKUP" || !ctx.zone) return { ok: true };
  const min = ctx.zone.minOrderMinor;
  const goods = breakdown.subtotalMinor - breakdown.discountMinor;
  if (goods >= min) return { ok: true };
  return { ok: false, shortfallMinor: min - goods, minOrderMinor: min };
}
