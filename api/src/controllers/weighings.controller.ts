import type { Request, Response } from "express";
import { uuid } from "../validators/common.js";
import {
  weighingCreate,
  weighingPatch,
  weighingFilters,
  cancellation,
} from "../validators/weighings.validator.js";
import {
  createWeighing,
  getWeighing,
  patchWeighing,
  cancelWeighing,
} from "../services/weighings.service.js";
import { listWeighings } from "../repositories/weighings.repository.js";
import { dashboard } from "../services/dashboard.service.js";
import { exportCsv, reportJson } from "../services/reports.service.js";
import { db } from "../config/database.js";
import { requireInternal, requireSuper } from "../policies/access.js";
import { z } from "zod";

export async function weighingList(req: Request, res: Response) {
  res.json(await listWeighings(req.context, weighingFilters.parse(req.query)));
}

export async function weighingGet(req: Request, res: Response) {
  res.json(await getWeighing(req.context, uuid.parse(req.params.id)));
}

export async function weighingPost(req: Request, res: Response) {
  res
    .status(201)
    .json(await createWeighing(req.context, weighingCreate.parse(req.body)));
}

export async function weighingUpdate(req: Request, res: Response) {
  res.json(
    await patchWeighing(
      req.context,
      uuid.parse(req.params.id),
      weighingPatch.parse(req.body),
    ),
  );
}

export async function weighingCancel(req: Request, res: Response) {
  const input = cancellation.parse(req.body);

  res.json(
    await cancelWeighing(
      req.context,
      uuid.parse(req.params.id),
      input.version,
      input.reason,
    ),
  );
}

export async function dashboardGet(req: Request, res: Response) {
  res.json(await dashboard(req.context, weighingFilters.parse(req.query)));
}

export async function reportGet(req: Request, res: Response) {
  const filters = weighingFilters.parse(req.query);

  if (filters.format === "csv") await exportCsv(req.context, filters, res);
  else res.json(await reportJson(req.context, filters));
}

const auditQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
    entity_type: z.string().max(80).optional(),
    entity_id: uuid.optional(),
  })
  .strict();

export async function auditsGet(req: Request, res: Response) {
  requireSuper(req.context);

  const query = auditQuery.parse(req.query);

  const where = {
    organization_id: req.context.organization_id,
    entity_type: query.entity_type,
    entity_id: query.entity_id,
  };

  const [data, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
    }),
    db.auditLog.count({ where }),
  ]);

  res.json({
    data,
    pagination: { page: query.page, page_size: query.page_size, total },
  });
}

export async function weighingAuditGet(req: Request, res: Response) {
  requireInternal(req.context);

  const id = uuid.parse(req.params.id);

  await getWeighing(req.context, id);

  const query = auditQuery
    .omit({ entity_type: true, entity_id: true })
    .parse(req.query);

  const where = {
    organization_id: req.context.organization_id,
    entity_type: "waste_bag_weighings",
    entity_id: id,
  };

  const [data, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    }),
    db.auditLog.count({ where }),
  ]);

  res.json({
    data,
    pagination: { page: query.page, page_size: query.page_size, total },
  });
}
