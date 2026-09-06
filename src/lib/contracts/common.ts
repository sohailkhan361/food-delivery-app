import { z } from "zod";

export const cuidSchema = z.string().min(1, "Required");

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Minor units only — an Int. Rejects "199.50" style input outright. */
export const minorAmountSchema = z
  .number()
  .int("Amounts must be in minor units (paise/cents)")
  .min(0);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number");

export type Pagination = z.infer<typeof paginationSchema>;
