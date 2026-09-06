import { z } from "zod";
import { cuidSchema, minorAmountSchema } from "./common";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  sortOrder: z.number().int().min(0).default(0),
});

export const optionInputSchema = z.object({
  id: cuidSchema.optional(),
  name: z.string().trim().min(1).max(60),
  priceDeltaMinor: z.number().int().default(0),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const optionGroupInputSchema = z
  .object({
    id: cuidSchema.optional(),
    name: z.string().trim().min(1).max(60),
    selectionType: z.enum(["SINGLE", "MULTIPLE"]).default("SINGLE"),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(1).default(1),
    sortOrder: z.number().int().min(0).default(0),
    options: z.array(optionInputSchema).min(1, "Add at least one option"),
  })
  .refine((g) => g.maxSelect >= g.minSelect, {
    error: "maxSelect must be greater than or equal to minSelect",
    path: ["maxSelect"],
  })
  .refine((g) => g.selectionType !== "SINGLE" || g.maxSelect === 1, {
    error: "A single-select group cannot allow more than one choice",
    path: ["maxSelect"],
  });

export const menuItemInputSchema = z.object({
  categoryId: cuidSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  priceMinor: minorAmountSchema.min(1, "Price must be greater than zero"),
  imageUrl: z.url("Must be a valid URL").optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  optionGroups: z.array(optionGroupInputSchema).default([]),
});

export const menuItemUpdateSchema = menuItemInputSchema.partial().extend({
  id: cuidSchema,
});

/** The high-frequency write: merchant flipping an item out of stock. */
export const toggleAvailabilitySchema = z.object({
  id: cuidSchema,
  isAvailable: z.boolean(),
});

export type MenuItemInput = z.infer<typeof menuItemInputSchema>;
export type OptionGroupInput = z.infer<typeof optionGroupInputSchema>;
