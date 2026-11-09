import type { Response } from "express";
import type { Context } from "../types/context.js";
import type { WeighingFilters } from "../validators/weighings.validator.js";
import {
  weighingWhere,
  weighingOrder,
} from "../repositories/weighings.repository.js";
import { db } from "../config/database.js";
import { once } from "node:events";

export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;

  return '"' + text.replaceAll('"', '""') + '"';
}

export async function exportCsv(
  ctx: Context,
  filters: WeighingFilters,
  res: Response,
) {
  const where = weighingWhere(ctx, filters, !filters.status);

  res.type("text/csv; charset=utf-8");
  res.attachment("pesagens.csv");

  const fields = [
    "id",
    "agency_id",
    "residue_type_id",
    "registered_by",
    "destination_partner_id",
    "weight_kg",
    "weighed_at",
    "status",
  ] as const;

  res.write("\uFEFF" + fields.map(csvCell).join(",") + "\r\n");

  // One repeatable-read snapshot prevents missing or mixing rows when corrections happen during export.
  await db.$transaction(
    async (tx) => {
      let cursor: string | undefined;

      for (;;) {
        if (res.destroyed) break;

        const rows = await tx.wasteBagWeighing.findMany({
          where,
          orderBy: { id: "asc" },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        if (!rows.length) break;

        for (const row of rows) {
          if (res.destroyed) break;

          if (
            !res.write(
              fields.map((field) => csvCell(row[field])).join(",") + "\r\n",
            )
          ) {
            const controller = new AbortController();

            try {
              await Promise.race([
                once(res, "drain", { signal: controller.signal }),
                once(res, "close", { signal: controller.signal }),
              ]);
            } finally {
              controller.abort();
            }
          }
        }

        cursor = rows.at(-1)!.id;
      }
    },
    { isolationLevel: "RepeatableRead", timeout: 60000 },
  );

  res.end();
}

export async function reportJson(ctx: Context, filters: WeighingFilters) {
  const where = weighingWhere(ctx, filters, !filters.status);

  return db.$transaction(
    async (tx) => {
      const data = await tx.wasteBagWeighing.findMany({
        where,
        orderBy: weighingOrder(filters),
        skip: (filters.page - 1) * filters.page_size,
        take: filters.page_size,
      });

      const total = await tx.wasteBagWeighing.aggregate({
        where,
        _sum: { weight_kg: true },
        _count: { _all: true },
        _avg: { weight_kg: true },
      });

      return {
        data,
        pagination: {
          page: filters.page,
          page_size: filters.page_size,
          total: total._count._all,
        },
        totals: {
          total_weight_kg: total._sum.weight_kg?.toFixed(3) ?? "0.000",
          weighing_count: total._count._all,
          average_weight_kg: total._avg.weight_kg?.toFixed(3) ?? "0.000",
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
