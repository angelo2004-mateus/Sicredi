import { Prisma } from "@prisma/client";
import { db } from "../config/database.js";
import {
  AppError,
  conflict,
  forbidden,
  notFound,
} from "../errors/app-error.js";
import type { Context } from "../types/context.js";
import {
  businessPolicy,
  requireInternal,
  weighingScope,
} from "../policies/access.js";
import type {
  WeighingCreate,
  WeighingPatch,
} from "../validators/weighings.validator.js";
import type { Tx } from "../repositories/resources.repository.js";
import { audit } from "./audit.service.js";

async function references(
  tx: Tx,
  ctx: Context,
  agency_id: string,
  residue_type_id: string,
  partner_id?: string | null,
) {
  const agency = await tx.agency.findFirst({
    where: {
      id: agency_id,
      organization_id: ctx.organization_id,
      status: "active",
    },
  });

  const residue = await tx.residueType.findFirst({
    where: {
      id: residue_type_id,
      organization_id: ctx.organization_id,
      status: "active",
    },
  });

  if (!agency || !residue)
    throw new AppError(
      400,
      "INVALID_REFERENCE",
      "Agência ou tipo de resíduo indisponível.",
    );

  if (partner_id) {
    const partner = await tx.partner.findFirst({
      where: {
        id: partner_id,
        organization_id: ctx.organization_id,
        status: "active",
      },
    });

    if (!partner)
      throw new AppError(400, "INVALID_REFERENCE", "Parceiro indisponível.");
  }
}

function validateTime(ctx: Context, weighed_at?: string) {
  if (weighed_at && ctx.role !== "super_admin") forbidden();
}

export async function createWeighing(ctx: Context, input: WeighingCreate) {
  requireInternal(ctx);
  validateTime(ctx, input.weighed_at);

  if (
    ctx.role !== "super_admin" &&
    input.agency_id &&
    input.agency_id !== ctx.agency_id
  )
    forbidden();

  const agency_id =
    ctx.role === "super_admin" ? input.agency_id : ctx.agency_id;

  if (!agency_id)
    throw new AppError(400, "AGENCY_REQUIRED", "Selecione uma agência.");

  return db.$transaction(
    async (tx) => {
      await references(
        tx,
        ctx,
        agency_id,
        input.residue_type_id,
        input.destination_partner_id,
      );

      const row = await tx.wasteBagWeighing.create({
        data: {
          organization_id: ctx.organization_id,
          agency_id,
          registered_by: ctx.user_id,
          residue_type_id: input.residue_type_id,
          weight_kg: new Prisma.Decimal(input.weight_kg),
          ...(input.weighed_at
            ? { weighed_at: new Date(input.weighed_at) }
            : {}),
          destination_partner_id: input.destination_partner_id,
          notes: input.notes,
        },
      });

      await audit(tx, ctx, "create", "waste_bag_weighings", row.id, null, row);

      return row;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function getWeighing(ctx: Context, id: string) {
  const row = await db.wasteBagWeighing.findFirst({
    where: { AND: [weighingScope(ctx), { id }] },
  });

  if (!row) notFound();

  return row;
}

function requireDefinedPolicy() {
  if (!businessPolicy.confirmed)
    throw new AppError(
      409,
      "BUSINESS_POLICY_PENDING",
      "Política de correção/cancelamento aguardando definição.",
    );
}

export async function patchWeighing(
  ctx: Context,
  id: string,
  input: WeighingPatch,
) {
  requireInternal(ctx);
  requireDefinedPolicy();
  validateTime(ctx, input.weighed_at);

  return db.$transaction(
    async (tx) => {
      const before = await tx.wasteBagWeighing.findFirst({
        where: { AND: [weighingScope(ctx), { id }] },
      });

      if (!before) notFound();
      if (before.status === "cancelled")
        conflict("Pesagem cancelada não pode ser corrigida.");

      if (
        ctx.role === "internal_employee" &&
        (before.registered_by !== ctx.user_id ||
          Date.now() - before.created_at.getTime() >
            businessPolicy.editWindowHours * 3600000)
      )
        forbidden();

      if (before.version !== input.version) conflict();

      await references(
        tx,
        ctx,
        before.agency_id,
        input.residue_type_id ?? before.residue_type_id,
        input.destination_partner_id === undefined
          ? before.destination_partner_id
          : input.destination_partner_id,
      );

      const { version, weight_kg, weighed_at, ...fields } = input;

      const result = await tx.wasteBagWeighing.updateMany({
        where: { id, organization_id: ctx.organization_id, version },
        data: {
          ...fields,
          ...(weight_kg ? { weight_kg: new Prisma.Decimal(weight_kg) } : {}),
          ...(weighed_at ? { weighed_at: new Date(weighed_at) } : {}),
          status: "corrected",
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) conflict();

      const after = await tx.wasteBagWeighing.findUniqueOrThrow({
        where: { id },
      });

      await audit(tx, ctx, "correct", "waste_bag_weighings", id, before, after);

      return after;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function cancelWeighing(
  ctx: Context,
  id: string,
  version: number,
  reason: string,
) {
  requireDefinedPolicy();

  if (!["super_admin", "agency_admin"].includes(ctx.role)) forbidden();

  return db.$transaction(
    async (tx) => {
      const before = await tx.wasteBagWeighing.findFirst({
        where: { AND: [weighingScope(ctx), { id }] },
      });

      if (!before) notFound();
      if (before.status === "cancelled") return before;
      if (before.version !== version) conflict();

      const result = await tx.wasteBagWeighing.updateMany({
        where: { id, organization_id: ctx.organization_id, version },
        data: { status: "cancelled", version: { increment: 1 } },
      });

      if (result.count !== 1) conflict();

      const after = await tx.wasteBagWeighing.findUniqueOrThrow({
        where: { id },
      });

      await audit(tx, ctx, "cancel", "waste_bag_weighings", id, before, {
        ...after,
        cancellation_reason: reason,
      });

      return after;
    },
    { isolationLevel: "Serializable" },
  );
}
