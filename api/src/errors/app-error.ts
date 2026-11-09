export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function forbidden(): never {
  throw new AppError(403, "FORBIDDEN", "Operação não permitida.");
}

export function notFound(): never {
  throw new AppError(404, "NOT_FOUND", "Recurso não encontrado.");
}

export function conflict(
  message = "O recurso foi alterado. Atualize e tente novamente.",
): never {
  throw new AppError(409, "CONFLICT", message);
}
