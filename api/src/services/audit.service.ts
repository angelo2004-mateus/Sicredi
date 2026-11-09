import { Prisma } from "@prisma/client";
import type { Context } from "../types/context.js";
import type { Tx } from "../repositories/resources.repository.js";

const blocked = new Set([
  "password",
  "password_hash",
  "cpf",
  "cnpj",
  "document",
  "email",
  "phone",
  "address",
  "notes",
  "token_hash",
  "csrf_hash",
]);

function snapshot(
  data: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (data == null) return Prisma.JsonNull;

  return JSON.parse(
    JSON.stringify(data, (key, value: unknown) =>
      blocked.has(key) ? undefined : value,
    ),
  ) as Prisma.InputJsonValue;
}

export async function audit(
  tx: Tx,
  ctx: Context,
  action: string,
  entity_type: string,
  entity_id: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      organization_id: ctx.organization_id,
      user_id: ctx.user_id,
      action,
      entity_type,
      entity_id,
      before_data: snapshot(before),
      after_data: snapshot(after),
      ip_address: ctx.ip_address,
    },
  });
}
