import type { Request, Response } from "express";
import { z } from "zod";
import {
  resourceSchemas,
  organizationSchema,
  type Resource,
} from "../validators/resources.validator.js";
import { pagination, uuid, recordStatus } from "../validators/common.js";
import {
  createResource,
  patchResource,
  linkAgencyPartner,
  linkPartnerType,
} from "../services/resources.service.js";
import {
  findResource,
  listResources,
  listPartnerOptions,
} from "../repositories/resources.repository.js";
import { db } from "../config/database.js";
import { AppError, notFound } from "../errors/app-error.js";
import { requireSuper, requireInternal } from "../policies/access.js";
import { audit } from "../services/audit.service.js";

export function resourceControllers(resource: Resource) {
  return {
    list: async (req: Request, res: Response) => {
      const query = pagination.parse(req.query);

      res.json(
        await listResources(
          req.context,
          resource,
          query.page,
          query.page_size,
          query.search,
        ),
      );
    },

    get: async (req: Request, res: Response) => {
      const row = await findResource(
        db,
        req.context,
        resource,
        uuid.parse(req.params.id),
      );

      if (!row) notFound();

      if (resource === "partners") {
        const agency_links = await db.agencyPartnerLink.findMany({
          where: {
            organization_id: req.context.organization_id,
            partner_id: row.id,
            ...(req.context.role !== "super_admin"
              ? { agency_id: req.context.agency_id ?? undefined }
              : {}),
          },
        });

        const type_links = await db.partnerTypeLink.findMany({
          where: {
            organization_id: req.context.organization_id,
            partner_id: row.id,
          },
        });

        // External users never receive the list of agencies served by the partner.
        res.json({
          ...row,
          agency_links: req.context.partner_id ? [] : agency_links,
          type_links,
        });
      } else res.json(row);
    },

    create: async (req: Request, res: Response) => {
      const input = resourceSchemas[resource].parse(req.body);
      const row = await createResource(req.context, resource, input);

      res.status(201).json(row);
    },

    patch: async (req: Request, res: Response) => {
      const id = uuid.parse(req.params.id);
      const input = resourceSchemas[resource].partial().parse(req.body);

      if (!Object.keys(input).length)
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Informe ao menos um campo.",
        );

      res.json(await patchResource(req.context, resource, id, input));
    },
  };
}

export async function organizationGet(req: Request, res: Response) {
  requireSuper(req.context);

  res.json(
    await db.organization.findUniqueOrThrow({
      where: { id: req.context.organization_id },
    }),
  );
}

export async function organizationPatch(req: Request, res: Response) {
  requireSuper(req.context);

  const input = organizationSchema.parse(req.body);

  const result = await db.$transaction(async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({
      where: { id: req.context.organization_id },
    });

    const after = await tx.organization.update({
      where: { id: req.context.organization_id },
      data: input,
    });

    await audit(
      tx,
      req.context,
      "update",
      "organizations",
      after.id,
      before,
      after,
    );

    return after;
  });

  res.json(result);
}

export async function agencyPartnerController(req: Request, res: Response) {
  const agency = uuid.parse(req.params.id);
  const partner = uuid.parse(req.params.partnerId);

  const { status } = z
    .object({ status: recordStatus })
    .strict()
    .parse(req.body);

  res.json(await linkAgencyPartner(req.context, agency, partner, status));
}

export async function partnerTypeController(req: Request, res: Response) {
  const partner = uuid.parse(req.params.id);
  const type = uuid.parse(req.params.typeId);

  const { enabled } = z
    .object({ enabled: z.boolean() })
    .strict()
    .parse(req.body);

  res.json(await linkPartnerType(req.context, partner, type, enabled));
}

export async function partnerOptionsController(req: Request, res: Response) {
  requireInternal(req.context);

  const query = pagination.parse(req.query);

  res.json(
    await listPartnerOptions(
      req.context,
      query.page,
      query.page_size,
      query.search,
    ),
  );
}
