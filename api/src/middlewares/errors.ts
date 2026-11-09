import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Erro interno do servidor.";
  let fields: unknown = {};

  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Entrada inválida.";
    fields = error.flatten().fieldErrors;
  } else if (error instanceof AppError) {
    ({ status, code, message } = error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const driver = error.meta?.driverAdapterError as
      { cause?: { originalCode?: string } } | undefined;

    const sqlCode = String(
      error.meta?.code ?? driver?.cause?.originalCode ?? "",
    );

    if (error.code === "P2002" || sqlCode === "23505") {
      status = 409;
      code = "DUPLICATE";
      message = "Já existe um cadastro com esses dados.";
    } else if (
      ["P2003", "P2025"].includes(error.code) ||
      ["23503", "23514", "22P02"].includes(sqlCode)
    ) {
      status = 400;
      code = "INVALID_REFERENCE";
      message = "Relacionamento ou dados inválidos.";
    } else if (error.code === "P2034") {
      status = 409;
      code = "CONCURRENT_UPDATE";
      message = "Atualização concorrente. Tente novamente.";
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    status = 400;
    code = "INVALID_JSON";
    message = "JSON inválido.";
  } else if (
    typeof error === "object" &&
    error &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Payload excede o limite.";
  }

  if (status === 500)
    logger.error(
      {
        request_id: req.request_id,
        error_type: error instanceof Error ? error.name : "unknown",
      },
      "request_failed",
    );

  if (res.headersSent) {
    res.destroy();

    return;
  }

  res
    .status(status)
    .json({ error: { code, message, fields }, request_id: req.request_id });
};
