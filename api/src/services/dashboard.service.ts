import { Prisma } from "@prisma/client";
import { db } from "../config/database.js";
import type { Context } from "../types/context.js";
import type { WeighingFilters } from "../validators/weighings.validator.js";
import {
  weighingSqlWhere,
  weighingWhere,
} from "../repositories/weighings.repository.js";
import { forbidden } from "../errors/app-error.js";
import { businessPolicy } from "../policies/access.js";

export async function dashboard(ctx: Context, filters: WeighingFilters) {
  if (
    !["super_admin", "agency_admin"].includes(ctx.role) &&
    !(businessPolicy.confirmed && ctx.role === "internal_employee")
  )
    forbidden();

  const where = weighingSqlWhere(ctx, filters);
  const metrics = Prisma.sql`coalesce(sum(weight_kg), 0)::text AS total_weight_kg, count(*)::int AS weighing_count, coalesce(round(avg(weight_kg), 3), 0)::text AS average_weight_kg`;

  return db.$transaction(
    async (tx) => {
      const totals = await tx.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`SELECT ${metrics} FROM waste_bag_weighings WHERE ${where}`,
      );

      const grouped = async (
        column: "agency_id" | "residue_type_id" | "destination_partner_id",
      ) => {
        const key = Prisma.raw(column);

        return tx.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`SELECT ${key}, ${metrics} FROM waste_bag_weighings WHERE ${where} GROUP BY ${key} ORDER BY sum(weight_kg) DESC, ${key}`,
        );
      };

      const by_agency = await grouped("agency_id");
      const by_residue_type = await grouped("residue_type_id");

      const by_partner = (await grouped("destination_partner_id")).filter(
        (r) => r.destination_partner_id !== null,
      );

      const by_period = await tx.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`SELECT date_trunc(${filters.period}, weighed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS period, ${metrics} FROM waste_bag_weighings WHERE ${where} GROUP BY 1 ORDER BY 1`,
      );

      const latest = await tx.wasteBagWeighing.findMany({
        where: weighingWhere(ctx, filters, true),
        orderBy: [{ weighed_at: "desc" }, { id: "asc" }],
        take: 10,
      });

      const agencies = await tx.agency.count({
        where: {
          organization_id: ctx.organization_id,
          ...(ctx.agency_id ? { id: ctx.agency_id } : {}),
          status: "active",
        },
      });

      const users = await tx.user.count({
        where: {
          organization_id: ctx.organization_id,
          ...(ctx.agency_id ? { agency_id: ctx.agency_id } : {}),
          ...(ctx.role === "internal_employee" ? { id: ctx.user_id } : {}),
          status: "active",
        },
      });

      const partners =
        ctx.role === "super_admin"
          ? await tx.partner.count({
              where: { organization_id: ctx.organization_id, status: "active" },
            })
          : await tx
              .$queryRaw<{ count: bigint }[]>(
                Prisma.sql`SELECT count(*) FROM partners p WHERE p.organization_id = ${ctx.organization_id}::uuid AND p.status = 'active' AND EXISTS (SELECT 1 FROM agency_partner_links l WHERE l.organization_id = p.organization_id AND l.partner_id = p.id AND l.agency_id = ${ctx.agency_id}::uuid AND l.status = 'active')`,
              )
              .then((r) => Number(r[0]?.count ?? 0));

      return {
        ...totals[0],
        by_agency,
        by_residue_type,
        by_partner,
        by_period,
        latest,
        counts: { agencies, users, partners },
        timezone: "UTC",
        period: filters.period,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
