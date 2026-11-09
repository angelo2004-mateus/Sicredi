import { Prisma } from "@prisma/client";
import type { Resource } from "../validators/resources.validator.js";
import type { Context } from "../types/context.js";
import { resourceScope } from "../policies/access.js";
import { db } from "../config/database.js";

export type Tx = Prisma.TransactionClient;

export type Row = Record<string, unknown> & {
  id: string;
  organization_id: string;
};

const tables: Record<Resource, string> = {
  agencies: "agencies",
  partners: "partners",
  users: "users",
  "residue-types": "residue_types",
  "partner-types": "partner_types",
};

export const tableName = (resource: Resource) => tables[resource];

// Identifiers originate exclusively from source-code allowlists / validated DTO keys.
const identifier = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw new Error("Invalid SQL identifier");

  return Prisma.raw(`"${s}"`);
};

const userColumns = Prisma.raw(
  "id, organization_id, agency_id, partner_id, name, email, role, status, created_at, updated_at",
);

const columns = (resource: Resource) =>
  resource === "users" ? userColumns : Prisma.raw("*");

export async function findResource(
  tx: Tx,
  ctx: Context,
  resource: Resource,
  id: string,
): Promise<Row | undefined> {
  const rows = await tx.$queryRaw<Row[]>(
    Prisma.sql`SELECT ${columns(resource)} FROM ${identifier(tables[resource])} WHERE ${resourceScope(ctx, resource)} AND id = ${id}::uuid`,
  );

  return rows[0];
}

export async function listResources(
  ctx: Context,
  resource: Resource,
  page: number,
  size: number,
  search?: string,
) {
  const name = identifier(tables[resource]);
  let where = resourceScope(ctx, resource);

  if (search) where = Prisma.sql`${where} AND name ILIKE ${"%" + search + "%"}`;

  const [data, totals] = await db.$transaction([
    db.$queryRaw<Row[]>(
      Prisma.sql`SELECT ${columns(resource)} FROM ${name} WHERE ${where} ORDER BY name, id LIMIT ${size} OFFSET ${(page - 1) * size}`,
    ),
    db.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT count(*) AS total FROM ${name} WHERE ${where}`,
    ),
  ]);

  return {
    data,
    pagination: { page, page_size: size, total: Number(totals[0]?.total ?? 0) },
  };
}

function valueSql(key: string, value: unknown): Prisma.Sql {
  const sql = Prisma.sql`${value}`;

  if (key === "id" || key.endsWith("_id")) return Prisma.sql`${sql}::uuid`;
  if (key === "role") return Prisma.sql`${sql}::"Role"`;
  if (key === "status") return Prisma.sql`${sql}::"RecordStatus"`;

  return sql;
}

export async function insertResource(
  tx: Tx,
  resource: Resource,
  values: Record<string, unknown>,
) {
  const keys = Object.keys(values);

  const rows = await tx.$queryRaw<Row[]>(
    Prisma.sql`INSERT INTO ${identifier(tables[resource])} (${Prisma.join(keys.map(identifier))}) VALUES (${Prisma.join(keys.map((k) => valueSql(k, values[k])))}) RETURNING ${columns(resource)}`,
  );

  return rows[0]!;
}

export async function updateResource(
  tx: Tx,
  ctx: Context,
  resource: Resource,
  id: string,
  values: Record<string, unknown>,
) {
  const assignments = Object.entries(values).map(
    ([key, value]) => Prisma.sql`${identifier(key)} = ${valueSql(key, value)}`,
  );

  const rows = await tx.$queryRaw<Row[]>(
    Prisma.sql`UPDATE ${identifier(tables[resource])} SET ${Prisma.join(assignments)} WHERE ${resourceScope(ctx, resource)} AND id = ${id}::uuid RETURNING ${columns(resource)}`,
  );

  return rows[0];
}

export async function listPartnerOptions(
  ctx: Context,
  page: number,
  size: number,
  search?: string,
) {
  let where = Prisma.sql`${resourceScope(ctx, "partners", true)} AND status = 'active'`;

  if (search) where = Prisma.sql`${where} AND name ILIKE ${"%" + search + "%"}`;

  const [data, totals] = await db.$transaction([
    db.$queryRaw<{ id: string; name: string; status: string }[]>(
      Prisma.sql`SELECT id, name, status FROM partners WHERE ${where} ORDER BY name, id LIMIT ${size} OFFSET ${(page - 1) * size}`,
    ),
    db.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT count(*) AS total FROM partners WHERE ${where}`,
    ),
  ]);

  return {
    data,
    pagination: { page, page_size: size, total: Number(totals[0]?.total ?? 0) },
  };
}
