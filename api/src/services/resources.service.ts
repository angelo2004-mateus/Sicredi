import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { db } from "../config/database.js";
import { AppError, forbidden, notFound } from "../errors/app-error.js";
import type { Context } from "../types/context.js";
import type { Resource } from "../validators/resources.validator.js";
import { canWriteResource, requireSuper } from "../policies/access.js";
import {
  findResource,
  insertResource,
  updateResource,
  tableName,
  type Tx,
  type Row,
} from "../repositories/resources.repository.js";
import { audit } from "./audit.service.js";

async function validateUser(
  tx: Tx,
  ctx: Context,
  values: Record<string, unknown>,
  before?: Row,
) {
  const merged = { ...before, ...values };

  if (ctx.role === "agency_admin") {
    if (before && before.role !== "internal_employee") forbidden();
    if (merged.role !== "internal_employee" || merged.partner_id) forbidden();
    if (values.agency_id && values.agency_id !== ctx.agency_id) forbidden();

    values.agency_id = ctx.agency_id;
    values.partner_id = null;
  } else if (ctx.role === "partner_admin") {
    if (before && before.role !== "partner_employee") forbidden();
    if (merged.role !== "partner_employee" || merged.agency_id) forbidden();
    if (values.partner_id && values.partner_id !== ctx.partner_id) forbidden();

    values.partner_id = ctx.partner_id;
    values.agency_id = null;
  }

  const next = { ...before, ...values };

  if (next.role === "super_admin") {
    if (next.agency_id || next.partner_id)
      throw new AppError(
        400,
        "INVALID_SCOPE",
        "Super Admin não pode estar associado a agência ou parceiro.",
      );
  } else if (
    ["agency_admin", "internal_employee"].includes(String(next.role))
  ) {
    if (!next.agency_id || next.partner_id)
      throw new AppError(
        400,
        "INVALID_SCOPE",
        "Perfil interno exige somente agência.",
      );

    const agency = await tx.agency.findFirst({
      where: {
        id: String(next.agency_id),
        organization_id: ctx.organization_id,
        status: "active",
      },
    });

    if (!agency) notFound();
  } else {
    if (!next.partner_id || next.agency_id)
      throw new AppError(
        400,
        "INVALID_SCOPE",
        "Perfil externo exige somente parceiro.",
      );

    const partner = await tx.partner.findFirst({
      where: {
        id: String(next.partner_id),
        organization_id: ctx.organization_id,
        status: "active",
      },
    });

    if (!partner) notFound();
  }

  if (
    before?.id === ctx.user_id &&
    (next.role !== ctx.role || next.status === "inactive")
  )
    forbidden();
}

async function syncPartnerRelations(
  tx: Tx,
  ctx: Context,
  partner_id: string,
  agencyIds?: string[],
  typeIds?: string[],
) {
  if (agencyIds !== undefined || typeIds !== undefined) requireSuper(ctx);

  if (agencyIds !== undefined) {
    const existing = await tx.agencyPartnerLink.findMany({
      where: {
        organization_id: ctx.organization_id,
        partner_id,
        status: "active",
      },
      select: { agency_id: true },
    });

    const count = await tx.agency.count({
      where: {
        organization_id: ctx.organization_id,
        id: { in: agencyIds },
        OR: [
          { status: "active" },
          { id: { in: existing.map((link) => link.agency_id) } },
        ],
      },
    });

    if (count !== agencyIds.length)
      throw new AppError(
        400,
        "INVALID_REFERENCE",
        "Selecione somente agências ativas da sua organização.",
      );

    await tx.agencyPartnerLink.updateMany({
      where: { organization_id: ctx.organization_id, partner_id },
      data: { status: "inactive" },
    });

    for (const agency_id of agencyIds) {
      await tx.agencyPartnerLink.upsert({
        where: { agency_id_partner_id: { agency_id, partner_id } },
        create: { organization_id: ctx.organization_id, agency_id, partner_id },
        update: { status: "active" },
      });
    }
  }

  if (typeIds !== undefined) {
    const existing = await tx.partnerTypeLink.findMany({
      where: { organization_id: ctx.organization_id, partner_id },
      select: { partner_type_id: true },
    });

    const count = await tx.partnerType.count({
      where: {
        organization_id: ctx.organization_id,
        id: { in: typeIds },
        OR: [
          { status: "active" },
          { id: { in: existing.map((link) => link.partner_type_id) } },
        ],
      },
    });

    if (count !== typeIds.length)
      throw new AppError(
        400,
        "INVALID_REFERENCE",
        "Selecione somente tipos de parceiros ativos da sua organização.",
      );

    await tx.partnerTypeLink.deleteMany({
      where: { organization_id: ctx.organization_id, partner_id },
    });

    if (typeIds.length) {
      await tx.partnerTypeLink.createMany({
        data: typeIds.map((partner_type_id) => ({
          organization_id: ctx.organization_id,
          partner_id,
          partner_type_id,
        })),
      });
    }
  }
}

async function partnerRelations(tx: Tx, ctx: Context, partner_id: string) {
  const agency_links = await tx.agencyPartnerLink.findMany({
    where: { organization_id: ctx.organization_id, partner_id },
  });
  const type_links = await tx.partnerTypeLink.findMany({
    where: { organization_id: ctx.organization_id, partner_id },
  });

  return { agency_links, type_links };
}

export async function createResource(
  ctx: Context,
  resource: Resource,
  input: Record<string, unknown>,
) {
  canWriteResource(ctx, resource);

  const { agency_ids, partner_type_ids, ...values } = input;

  if (agency_ids !== undefined || partner_type_ids !== undefined)
    requireSuper(ctx);

  if (resource === "users" && typeof values.password === "string") {
    values.password_hash = await argon2.hash(values.password, {
      type: argon2.argon2id,
    });
    delete values.password;
  }

  return db.$transaction(async (tx) => {
    if (resource === "users") await validateUser(tx, ctx, values);

    const now = new Date();

    const created = await insertResource(tx, resource, {
      id: randomUUID(),
      organization_id: ctx.organization_id,
      ...values,
      created_at: now,
      updated_at: now,
    });

    if (resource === "partners" && ctx.role === "agency_admin") {
      await tx.agencyPartnerLink.create({
        data: {
          organization_id: ctx.organization_id,
          agency_id: ctx.agency_id!,
          partner_id: created.id,
        },
      });
    }

    if (resource === "partners") {
      await syncPartnerRelations(
        tx,
        ctx,
        created.id,
        agency_ids as string[] | undefined,
        partner_type_ids as string[] | undefined,
      );

      Object.assign(created, await partnerRelations(tx, ctx, created.id));
    }

    await audit(
      tx,
      ctx,
      "create",
      tableName(resource),
      created.id,
      null,
      created,
    );

    return created;
  });
}

export async function patchResource(
  ctx: Context,
  resource: Resource,
  id: string,
  input: Record<string, unknown>,
) {
  canWriteResource(ctx, resource);

  // Shared partner master data can only be changed centrally; agency admins maintain their own link.
  if (resource === "partners") requireSuper(ctx);

  const { agency_ids, partner_type_ids, ...values } = input;

  if (agency_ids !== undefined || partner_type_ids !== undefined)
    requireSuper(ctx);

  if (resource === "users" && typeof values.password === "string") {
    values.password_hash = await argon2.hash(values.password, {
      type: argon2.argon2id,
    });
    delete values.password;
  }

  return db.$transaction(
    async (tx) => {
      const before = await findResource(tx, ctx, resource, id);

      if (!before) notFound();

      if (resource === "partners")
        Object.assign(before, await partnerRelations(tx, ctx, id));

      if (resource === "users") await validateUser(tx, ctx, values, before);

      const after = await updateResource(tx, ctx, resource, id, {
        ...values,
        updated_at: new Date(),
      });

      if (!after) notFound();
      if (resource === "users")
        await tx.session.deleteMany({ where: { user_id: id } });

      if (resource === "partners") {
        await syncPartnerRelations(
          tx,
          ctx,
          id,
          agency_ids as string[] | undefined,
          partner_type_ids as string[] | undefined,
        );

        Object.assign(after, await partnerRelations(tx, ctx, id));
      }

      await audit(tx, ctx, "update", tableName(resource), id, before, after);

      return after;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function linkAgencyPartner(
  ctx: Context,
  agency_id: string,
  partner_id: string,
  status: "active" | "inactive",
) {
  if (ctx.role !== "super_admin" && ctx.role !== "agency_admin") forbidden();
  if (ctx.role === "agency_admin" && agency_id !== ctx.agency_id) notFound();

  return db.$transaction(async (tx) => {
    const agency = await tx.agency.findFirst({
      where: { id: agency_id, organization_id: ctx.organization_id },
    });

    const partner = await tx.partner.findFirst({
      where: { id: partner_id, organization_id: ctx.organization_id },
    });

    if (!agency || !partner) notFound();

    const before = await tx.agencyPartnerLink.findUnique({
      where: { agency_id_partner_id: { agency_id, partner_id } },
    });

    const after = await tx.agencyPartnerLink.upsert({
      where: { agency_id_partner_id: { agency_id, partner_id } },
      create: {
        organization_id: ctx.organization_id,
        agency_id,
        partner_id,
        status,
      },
      update: { status },
    });

    await audit(
      tx,
      ctx,
      "link_status",
      "agency_partner_links",
      partner_id,
      before,
      after,
    );

    return after;
  });
}

export async function linkPartnerType(
  ctx: Context,
  partner_id: string,
  partner_type_id: string,
  enabled: boolean,
) {
  requireSuper(ctx);

  return db.$transaction(async (tx) => {
    const partner = await tx.partner.findFirst({
      where: { id: partner_id, organization_id: ctx.organization_id },
    });

    const type = await tx.partnerType.findFirst({
      where: { id: partner_type_id, organization_id: ctx.organization_id },
    });

    if (!partner || !type) notFound();

    const before = await tx.partnerTypeLink.findUnique({
      where: { partner_id_partner_type_id: { partner_id, partner_type_id } },
    });

    let after = null;

    if (enabled)
      after = await tx.partnerTypeLink.upsert({
        where: { partner_id_partner_type_id: { partner_id, partner_type_id } },
        create: {
          organization_id: ctx.organization_id,
          partner_id,
          partner_type_id,
        },
        update: {},
      });
    else
      await tx.partnerTypeLink.deleteMany({
        where: {
          organization_id: ctx.organization_id,
          partner_id,
          partner_type_id,
        },
      });

    await audit(
      tx,
      ctx,
      "type_link",
      "partner_type_links",
      partner_id,
      before,
      after,
    );

    return after;
  });
}
