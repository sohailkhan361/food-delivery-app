import { z } from "zod";
import { cuidSchema } from "./common";

export const addressInputSchema = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(3, "Address is required").max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(12),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
});

export const addressUpdateSchema = addressInputSchema.partial().extend({
  id: cuidSchema,
});

export type AddressInput = z.infer<typeof addressInputSchema>;
