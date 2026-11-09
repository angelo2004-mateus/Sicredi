import argon2 from "argon2";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { authRepository } from "../repositories/auth.repository.js";
import { digest, secret } from "../utils/security.js";
import type { User } from "@prisma/client";

export async function activeIdentity(user: User) {
  if (user.status !== "active") return false;

  const org = await authRepository.organization(user.organization_id);

  if (org?.status !== "active") return false;

  if (user.agency_id) {
    const agency = await authRepository.agency(user.agency_id);

    if (
      agency?.status !== "active" ||
      agency.organization_id !== user.organization_id
    )
      return false;
  }

  if (user.partner_id) {
    const partner = await authRepository.partner(user.partner_id);

    if (
      partner?.status !== "active" ||
      partner.organization_id !== user.organization_id
    )
      return false;
  }

  return true;
}

// One valid dummy hash avoids a fast-path distinction for unknown addresses.
const dummyHash = argon2.hash(secret(), { type: argon2.argon2id });

export async function login(email: string, password: string) {
  const user = await authRepository.userByEmail(email);

  const valid = await argon2.verify(
    user?.password_hash ?? (await dummyHash),
    password,
  );

  if (!user || !valid || !(await activeIdentity(user)))
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "E-mail ou senha inválidos.",
    );

  const token = secret();
  const csrfToken = secret();
  const expires_at = new Date(Date.now() + env.SESSION_HOURS * 3600000);

  await db.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { expires_at: { lt: new Date() } } });

    await tx.session.create({
      data: {
        user_id: user.id,
        token_hash: digest(token),
        csrf_hash: digest(csrfToken),
        expires_at,
      },
    });
  });

  return { token, csrfToken, expires_at };
}
