import type { Request, Response } from "express";
import { z } from "zod";
import { email } from "../validators/common.js";
import { login } from "../services/auth.service.js";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import {
  profile,
  updateProfile,
  changePassword,
} from "../services/profile.service.js";
import { effectivePermissions } from "../policies/access.js";
import {
  changePasswordSchema,
  profileSchema,
} from "../validators/resources.validator.js";

const cookieOptions = {
  httpOnly: true,
  secure:
    env.NODE_ENV === "production" || env.APP_ORIGIN.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
};

export async function loginController(req: Request, res: Response) {
  const input = z
    .object({ email, password: z.string().min(1).max(128) })
    .strict()
    .parse(req.body);

  const result = await login(input.email, input.password);
  // Rotate any previous session supplied by this client.
  const previous: unknown = req.cookies?.session;

  if (typeof previous === "string") {
    const { digest } = await import("../utils/security.js");

    await db.session.deleteMany({ where: { token_hash: digest(previous) } });
  }

  res.cookie("session", result.token, {
    ...cookieOptions,
    expires: result.expires_at,
  });

  res.json({ csrf_token: result.csrfToken, expires_at: result.expires_at });
}

export async function logoutController(req: Request, res: Response) {
  await db.session.deleteMany({ where: { id: req.context.session_id } });
  res.clearCookie("session", cookieOptions).status(204).end();
}

export async function meController(req: Request, res: Response) {
  res.json({
    ...(await profile(req.context)),
    permissions: effectivePermissions(req.context),
  });
}

export async function profileController(req: Request, res: Response) {
  const input = profileSchema.parse(req.body);

  res.json(await updateProfile(req.context, input.name!));
}

export async function passwordController(req: Request, res: Response) {
  const input = changePasswordSchema.parse(req.body);

  await changePassword(req.context, input.current_password, input.new_password);
  res.clearCookie("session", cookieOptions).status(204).end();
}
