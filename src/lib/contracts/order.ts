import { z } from "zod";
import { cuidSchema, phoneSchema } from "./common";

export const cartLineSchema = z.object({
  menuItemId: cuidSchema,
  quantity: z.number().int().min(1).max(50),
  /** Selected option ids. The server re-reads their real prices. */
  optionIds: z.array(cuidSchema).default([]),
  note: z.string().trim().max(200).optional(),
});

/**
 * Notice what is NOT here: no prices, no totals. The client sends what the
 * customer chose; the server decides what it costs.
 */
export const placeOrderSchema = z
  .object({
    restaurantId: cuidSchema,
    type: z.enum(["DELIVERY", "PICKUP"]),
    addressId: cuidSchema.optional(),
    lines: z.array(cartLineSchema).min(1, "Your cart is empty"),
    contactPhone: phoneSchema,
    customerNote: z.string().trim().max(300).optional(),
    paymentMethod: z.enum(["ONLINE", "COD"]),
    /** Client-generated (crypto.randomUUID) so a double submit is a no-op. */
    idempotencyKey: z.string().uuid("Must be a UUID"),
  })
  .refine((o) => o.type === "PICKUP" || !!o.addressId, {
    error: "Choose a delivery address",
    path: ["addressId"],
  });

/** Restaurant accepting an order commits to a prep time. */
export const acceptOrderSchema = z.object({
  orderId: cuidSchema,
  prepMinutes: z.number().int().min(5).max(120),
});

export const rejectOrderSchema = z.object({
  orderId: cuidSchema,
  reason: z.string().trim().min(3, "Tell the customer why").max(200),
});

export const advanceOrderSchema = z.object({
  orderId: cuidSchema,
  to: z.enum([
    "PREPARING",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "COLLECTED",
  ]),
});

export const cancelOrderSchema = z.object({
  orderId: cuidSchema,
  reason: z.string().trim().max(200).optional(),
});

export type CartLine = z.infer<typeof cartLineSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
