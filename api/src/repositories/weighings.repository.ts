import { Prisma } from "@prisma/client";
import type { Context } from "../types/context.js";
import type { WeighingFilters } from "../validators/weighings.validator.js";
import { db } from "../config/database.js";
import { weighingScope, businessPolicy } from "../policies/access.js";
import { forbidden } from "../errors/app-error.js";

export function weighingWhere(
  ctx: Context,
  filters: WeighingFilters,
  indicators = false,
): Prisma.WasteBagWeighingWhereInput {
  const scope = weighingScope(ctx);

  if (
    filters.agency_id &&
    ctx.role !== "super_admin" &&
    filters.agency_id !== ctx.agency_id
  )
    forbidden();

  if (
    filters.registered_by &&
    ctx.role === "internal_employee" &&
    filters.registered_by !== ctx.user_id
  )
    forbidden();

  if (
    filters.destination_partner_id &&
    ctx.partner_id &&
    filters.destination_partner_id !== ctx.partner_id
  )
    forbidden();

  const selected: Prisma.WasteBagWeighingWhereInput = {
    agency_id: filters.agency_id,
    residue_type_id: filters.residue_type_id,
    registered_by: filters.registered_by,
    destination_partner_id: filters.destination_partner_id,
    weighed_at: {
      gte: filters.start_date ? new Date(filters.start_date) : undefined,
      lt: filters.end_date ? new Date(filters.end_date) : undefined,
    },
    status: indicators
      ? {
          in: businessPolicy.includeCorrectedInTotals
            ? ["active", "corrected"]
            : ["active"],
        }
      : filters.status,
  };

  return { AND: [scope, selected] };
}

export function weighingOrder(
  filters: WeighingFilters,
): Prisma.WasteBagWeighingOrderByWithRelationInput[] {
  const descending = filters.sort.startsWith("-");
  const field = descending ? filters.sort.slice(1) : filters.sort;

  return [{ [field]: descending ? "desc" : "asc" }, { id: "asc" }];
}

export async function listWeighings(
  ctx: Context,
  filters: WeighingFilters,
  operationalDefault = false,
) {
  const where = weighingWhere(
    ctx,
    filters,
    operationalDefault && !filters.status,
  );

  const [data, total] = await db.$transaction([
    db.wasteBagWeighing.findMany({
      where,
      orderBy: weighingOrder(filters),
      skip: (filters.page - 1) * filters.page_size,
      take: filters.page_size,
    }),
    db.wasteBagWeighing.count({ where }),
  ]);

  return {
    data,
    pagination: { page: filters.page, page_size: filters.page_size, total },
  };
}

// SQL form of the same scope and filters, used exclusively by aggregate queries.
export function weighingSqlWhere(
  ctx: Context,
  filters: WeighingFilters,
  indicators = true,
): Prisma.Sql {
  weighingWhere(ctx, filters, indicators); // Validate scope and attempted filter escalation.
  const clauses: Prisma.Sql[] = [
    Prisma.sql`organization_id = ${ctx.organization_id}::uuid`,
  ];

  if (ctx.role === "agency_admin" || ctx.role === "internal_employee")
    clauses.push(Prisma.sql`agency_id = ${ctx.agency_id}::uuid`);
  if (ctx.role === "internal_employee")
    clauses.push(Prisma.sql`registered_by = ${ctx.user_id}::uuid`);
  if (ctx.partner_id)
    clauses.push(Prisma.sql`destination_partner_id = ${ctx.partner_id}::uuid`);
  if (filters.agency_id)
    clauses.push(Prisma.sql`agency_id = ${filters.agency_id}::uuid`);

  if (filters.residue_type_id)
    clauses.push(
      Prisma.sql`residue_type_id = ${filters.residue_type_id}::uuid`,
    );

  if (filters.registered_by)
    clauses.push(Prisma.sql`registered_by = ${filters.registered_by}::uuid`);

  if (filters.destination_partner_id)
    clauses.push(
      Prisma.sql`destination_partner_id = ${filters.destination_partner_id}::uuid`,
    );

  if (filters.start_date)
    clauses.push(Prisma.sql`weighed_at >= ${new Date(filters.start_date)}`);
  if (filters.end_date)
    clauses.push(Prisma.sql`weighed_at < ${new Date(filters.end_date)}`);

  if (indicators)
    clauses.push(
      businessPolicy.includeCorrectedInTotals
        ? Prisma.sql`status IN ('active', 'corrected')`
        : Prisma.sql`status = 'active'`,
    );
  else if (filters.status)
    clauses.push(Prisma.sql`status = ${filters.status}::"WeighingStatus"`);

  return Prisma.join(clauses, " AND ");
}
