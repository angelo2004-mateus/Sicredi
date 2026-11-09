import { Prisma, type Role } from "@prisma/client";
import type { Context } from "../types/context.js";
import type { Resource } from "../validators/resources.validator.js";
import { forbidden } from "../errors/app-error.js";

// Conditional permissions remain denied until the business policy is approved.
export const businessPolicy = {
  confirmed: false,
  editWindowHours: 24,
  includeCorrectedInTotals: false,
  partnerReadEnabled: false,
};

export const isPartner = (ctx: Context) =>
  ctx.role === "partner_admin" || ctx.role === "partner_employee";

export function requireSuper(ctx: Context) {
  if (ctx.role !== "super_admin") forbidden();
}

export function requireInternal(ctx: Context) {
  if (isPartner(ctx)) forbidden();
}

export function resourceScope(
  ctx: Context,
  resource: Resource,
  partnerLookup = false,
): Prisma.Sql {
  const tenant = Prisma.sql`organization_id = ${ctx.organization_id}::uuid`;

  if (ctx.role === "super_admin") return tenant;

  if (resource === "agencies") {
    if (!ctx.agency_id) forbidden();

    return Prisma.sql`${tenant} AND id = ${ctx.agency_id}::uuid`;
  }

  if (resource === "users") {
    if (ctx.role === "agency_admin")
      return Prisma.sql`${tenant} AND agency_id = ${ctx.agency_id}::uuid`;
    if (ctx.role === "partner_admin")
      return Prisma.sql`${tenant} AND partner_id = ${ctx.partner_id}::uuid`;

    return Prisma.sql`${tenant} AND id = ${ctx.user_id}::uuid`;
  }

  if (resource === "partners") {
    if (ctx.role === "internal_employee" && !partnerLookup) forbidden();

    if (isPartner(ctx))
      return Prisma.sql`${tenant} AND id = ${ctx.partner_id}::uuid`;

    return Prisma.sql`${tenant} AND EXISTS (SELECT 1 FROM agency_partner_links l WHERE l.partner_id = partners.id AND l.organization_id = partners.organization_id AND l.agency_id = ${ctx.agency_id}::uuid AND l.status = 'active')`;
  }

  if (isPartner(ctx)) forbidden();

  return tenant;
}

export function canWriteResource(ctx: Context, resource: Resource) {
  if (ctx.role === "super_admin") return;

  if (
    resource === "users" &&
    ["agency_admin", "partner_admin"].includes(ctx.role)
  )
    return;

  if (resource === "partners" && ctx.role === "agency_admin") return;

  forbidden();
}

export function weighingScope(ctx: Context): Prisma.WasteBagWeighingWhereInput {
  const scope: Prisma.WasteBagWeighingWhereInput = {
    organization_id: ctx.organization_id,
  };

  if (ctx.role === "super_admin") return scope;

  if (isPartner(ctx)) {
    if (!businessPolicy.partnerReadEnabled) forbidden();

    return { ...scope, destination_partner_id: ctx.partner_id! };
  }

  if (ctx.role === "internal_employee")
    return { ...scope, agency_id: ctx.agency_id!, registered_by: ctx.user_id };

  return { ...scope, agency_id: ctx.agency_id! };
}

export function assignableUserRoles(ctx: Context): Role[] {
  if (ctx.role === "super_admin") {
    return [
      "super_admin",
      "agency_admin",
      "internal_employee",
      "partner_admin",
      "partner_employee",
    ];
  }

  if (ctx.role === "agency_admin") return ["internal_employee"];
  if (ctx.role === "partner_admin") return ["partner_employee"];

  return [];
}

export function effectivePermissions(ctx: Context) {
  const central = ctx.role === "super_admin";
  const userRoles = assignableUserRoles(ctx);

  return {
    read_partners: ctx.role !== "internal_employee",
    assignable_user_roles: userRoles,
    resources: {
      agencies: { create: central, update: central },
      users: { create: userRoles.length > 0, update: userRoles.length > 0 },
      partners: {
        create: central || ctx.role === "agency_admin",
        update: central,
      },
      "partner-types": { create: central, update: central },
      "residue-types": { create: central, update: central },
    },
    manage_partner_links: central || ctx.role === "agency_admin",
    manage_partner_classification: central,
    manage_agencies: ctx.role === "super_admin",
    manage_users: ["super_admin", "agency_admin", "partner_admin"].includes(
      ctx.role,
    ),
    manage_residue_types: ctx.role === "super_admin",
    create_weighing: !isPartner(ctx),
    edit_weighing: businessPolicy.confirmed && !isPartner(ctx),
    cancel_weighing:
      businessPolicy.confirmed &&
      ["super_admin", "agency_admin"].includes(ctx.role),
    general_dashboard: ctx.role === "super_admin",
    agency_dashboard: ["super_admin", "agency_admin"].includes(ctx.role),
    read_partner_weighings: businessPolicy.partnerReadEnabled && isPartner(ctx),
    adjust_weighed_at: ctx.role === "super_admin",
  };
}
