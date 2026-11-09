import argon2 from "argon2";
import { db } from "../config/database.js";
import { forbidden, notFound } from "../errors/app-error.js";
import type { Context } from "../types/context.js";
import { audit } from "./audit.service.js";

export async function profile(ctx: Context) {
  const user = await db.user.findFirst({
    where: { id: ctx.user_id, organization_id: ctx.organization_id },
    select: {
      id: true,
      organization_id: true,
      name: true,
      email: true,
      role: true,
      agency_id: true,
      partner_id: true,
      status: true,
    },
  });

  if (!user) notFound();

  return user;
}

export async function updateProfile(ctx: Context, name: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({
      where: { id: ctx.user_id },
    });

    const after = await tx.user.update({
      where: { id: ctx.user_id },
      data: { name },
    });

    await audit(tx, ctx, "update_profile", "users", ctx.user_id, before, after);

    return { id: after.id, name: after.name };
  });
}

export async function changePassword(
  ctx: Context,
  current: string,
  password: string,
) {
  const before = await db.user.findUniqueOrThrow({
    where: { id: ctx.user_id },
  });

  if (!(await argon2.verify(before.password_hash, current))) forbidden();

  const password_hash = await argon2.hash(password, { type: argon2.argon2id });

  await db.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: ctx.user_id,
        organization_id: ctx.organization_id,
        password_hash: before.password_hash,
      },
      data: { password_hash },
    });

    if (result.count !== 1) forbidden();

    await tx.session.deleteMany({ where: { user_id: ctx.user_id } });
    await audit(tx, ctx, "change_password", "users", ctx.user_id, null, {
      sessions_revoked: true,
    });
  });
}
