import type { Request, Response } from "express";
import { db } from "../config/database.js";
import { digest, secret } from "../utils/security.js";

export async function csrfController(req: Request, res: Response) {
  const csrf_token = secret();

  await db.session.update({
    where: { id: req.context.session_id },
    data: { csrf_hash: digest(csrf_token) },
  });

  res.set("Cache-Control", "no-store").json({ csrf_token });
}
