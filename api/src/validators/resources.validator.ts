import { z } from "zod";
import {
  text,
  email,
  password,
  cpf,
  cnpj,
  recordStatus,
  role,
  uuid,
} from "./common.js";

const nullable = text.nullable().optional();

const uniqueIds = z
  .array(uuid)
  .max(1000)
  .refine((ids) => new Set(ids).size === ids.length, "Não repita os vínculos.");

export const resourceSchemas = {
  agencies: z
    .object({
      code: text,
      name: text,
      cnpj: cnpj.optional(),
      address: nullable,
      city: nullable,
      state: z.string().length(2).toUpperCase().nullable().optional(),
      region: nullable,
      technical_responsible: nullable,
      status: recordStatus.optional(),
    })
    .strict(),

  partners: z
    .object({
      name: text,
      trade_name: nullable,
      cnpj: cnpj.optional(),
      phone: nullable,
      email: email.nullable().optional(),
      address: nullable,
      city: nullable,
      state: z.string().length(2).toUpperCase().nullable().optional(),
      status: recordStatus.optional(),
      agency_ids: uniqueIds.optional(),
      partner_type_ids: uniqueIds.optional(),
    })
    .strict(),

  "partner-types": z
    .object({
      name: text,
      description: z.string().max(2000).nullable().optional(),
      status: recordStatus.optional(),
    })
    .strict(),

  "residue-types": z
    .object({
      name: text,
      description: z.string().max(2000).nullable().optional(),
      color: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .nullable()
        .optional(),
      default_destination: nullable,
      status: recordStatus.optional(),
    })
    .strict(),

  users: z
    .object({
      name: text,
      cpf: cpf.optional(),
      email,
      password,
      role,
      agency_id: uuid.nullable().optional(),
      partner_id: uuid.nullable().optional(),
      status: recordStatus.optional(),
    })
    .strict(),
};

export type Resource = keyof typeof resourceSchemas;

export const organizationSchema = z
  .object({
    name: text.optional(),
    document: cnpj.optional(),
    status: recordStatus.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo.");

export const profileSchema = z
  .object({ name: text.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo.");

export const changePasswordSchema = z
  .object({ current_password: z.string().max(128), new_password: password })
  .strict();
