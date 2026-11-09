import { z } from "zod";

export const uuid = z.string().uuid();

export const recordStatus = z.enum(["active", "inactive"]);

export const role = z.enum([
  "super_admin",
  "agency_admin",
  "internal_employee",
  "partner_admin",
  "partner_employee",
]);

export const text = z.string().trim().min(1).max(255);

export const email = z.string().trim().toLowerCase().email().max(254);

export const password = z.string().min(12).max(128);

const document = (length: number) =>
  z
    .string()
    .transform((v) => v.replace(/[.\-/\s]/g, ""))
    .pipe(z.string().regex(new RegExp(`^\\d{${length}}$`)));

export const cpf = document(11).nullable();

export const cnpj = document(14).nullable();

export const pagination = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
