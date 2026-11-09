import { z } from "zod";
import { Prisma } from "@prisma/client";
import { uuid } from "./common.js";

export const weight = z
  .union([z.string(), z.number().finite()])
  .transform(String)
  .refine(
    (v) =>
      /^\d{1,7}(\.\d{1,3})?$/.test(v) && new Prisma.Decimal(v).greaterThan(0),
    "Peso deve ser maior que zero, com no máximo 3 casas decimais e 7 dígitos inteiros.",
  );

export const weighingCreate = z
  .object({
    agency_id: uuid.optional(),
    residue_type_id: uuid,
    weight_kg: weight,
    weighed_at: z.iso.datetime({ offset: true }).optional(),
    destination_partner_id: uuid.nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict();

export const weighingPatch = weighingCreate
  .omit({ agency_id: true })
  .partial()
  .extend({ version: z.number().int().min(1) })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Informe os campos a corrigir.");

export const cancellation = z
  .object({
    version: z.number().int().min(1),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const weighingFilters = z
  .object({
    start_date: z.iso.datetime({ offset: true }).optional(),
    end_date: z.iso.datetime({ offset: true }).optional(),
    agency_id: uuid.optional(),
    residue_type_id: uuid.optional(),
    registered_by: uuid.optional(),
    destination_partner_id: uuid.optional(),
    status: z.enum(["active", "corrected", "cancelled"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    sort: z
      .enum([
        "weighed_at",
        "-weighed_at",
        "weight_kg",
        "-weight_kg",
        "created_at",
        "-created_at",
      ])
      .default("-weighed_at"),
    format: z.enum(["json", "csv"]).default("json"),
    period: z.enum(["day", "week", "month"]).default("day"),
  })
  .strict()
  .refine(
    (v) =>
      !v.start_date ||
      !v.end_date ||
      new Date(v.start_date) <= new Date(v.end_date),
    "Período inválido.",
  );

export type WeighingFilters = z.infer<typeof weighingFilters>;

export type WeighingCreate = z.infer<typeof weighingCreate>;

export type WeighingPatch = z.infer<typeof weighingPatch>;
