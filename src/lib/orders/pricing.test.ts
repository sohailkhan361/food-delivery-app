import { describe, expect, it } from "vitest";
import { checkMinimumOrder, computePricing, PricingError } from "./pricing";

const zone = { deliveryFeeMinor: 2900, minOrderMinor: 14900 };
const ctx = { orderType: "DELIVERY" as const, packingFeeMinor: 1500, taxPercent: "5.00", zone };

describe("computePricing", () => {
  it("prices options per unit, not per line", () => {
    const b = computePricing(
      [{ unitPriceMinor: 24900, quantity: 2, optionDeltasMinor: [4000] }],
      ctx,
    );
    expect(b.subtotalMinor).toBe((24900 + 4000) * 2);
  });

  it("taxes goods plus packing, but never the delivery fee", () => {
    const b = computePricing([{ unitPriceMinor: 10000, quantity: 1 }], ctx);
    expect(b.taxMinor).toBe(Math.round((10000 + 1500) * 0.05));
    expect(b.totalMinor).toBe(10000 + 1500 + b.taxMinor + 2900);
  });

  it("caps a discount at the subtotal so a total can never go negative", () => {
    const b = computePricing([{ unitPriceMinor: 5000, quantity: 1 }], {
      ...ctx,
      discountMinor: 999999,
    });
    expect(b.discountMinor).toBe(5000);
    expect(b.totalMinor).toBeGreaterThanOrEqual(0);
  });

  it("charges no delivery fee on pickup", () => {
    const b = computePricing([{ unitPriceMinor: 10000, quantity: 1 }], {
      ...ctx,
      orderType: "PICKUP",
    });
    expect(b.deliveryFeeMinor).toBe(0);
  });

  it("refuses a delivery order with no resolved zone", () => {
    expect(() =>
      computePricing([{ unitPriceMinor: 10000, quantity: 1 }], { ...ctx, zone: null }),
    ).toThrow(PricingError);
  });

  it("rejects an empty cart and bad quantities", () => {
    expect(() => computePricing([], ctx)).toThrow(PricingError);
    expect(() =>
      computePricing([{ unitPriceMinor: 100, quantity: 0 }], ctx),
    ).toThrow(PricingError);
  });
});

describe("checkMinimumOrder", () => {
  it("measures the minimum against goods, not fees", () => {
    const b = computePricing([{ unitPriceMinor: 10000, quantity: 1 }], ctx);
    // 100.00 of goods + fees clears 149.00 overall, but goods alone do not.
    const result = checkMinimumOrder(b, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.shortfallMinor).toBe(4900);
  });

  it("passes once goods clear the minimum", () => {
    const b = computePricing([{ unitPriceMinor: 20000, quantity: 1 }], ctx);
    expect(checkMinimumOrder(b, ctx).ok).toBe(true);
  });
});
