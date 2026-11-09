import type { RequestHandler } from "express";
import { authRepository } from "../repositories/auth.repository.js";
import { activeIdentity } from "../services/auth.service.js";
import { digest, matchesHash } from "../utils/security.js";
import { AppError } from "../errors/app-error.js";
import { env } from "../config/env.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.session;

  if (typeof token !== "string")
    throw new AppError(401, "UNAUTHENTICATED", "Autenticação necessária.");

  const session = await authRepository.sessionByHash(digest(token));

  if (!session || session.expires_at <= new Date())
    throw new AppError(401, "UNAUTHENTICATED", "Sessão expirada ou inválida.");

  const user = await authRepository.userById(session.user_id);

  if (!user || !(await activeIdentity(user)))
    throw new AppError(401, "UNAUTHENTICATED", "Sessão inválida.");

  req.context = {
    user_id: user.id,
    organization_id: user.organization_id,
    agency_id: user.agency_id,
    partner_id: user.partner_id,
    role: user.role,
    session_id: session.id,
    ip_address: req.ip,
  };

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const csrf = req.get("x-csrf-token");

    if (!csrf || !matchesHash(csrf, session.csrf_hash))
      throw new AppError(403, "CSRF_INVALID", "Token CSRF inválido.");
  }

  next();
};

export const originGuard: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");

  if (origin && origin !== env.APP_ORIGIN)
    throw new AppError(403, "ORIGIN_INVALID", "Origem não permitida.");

  next();
};
