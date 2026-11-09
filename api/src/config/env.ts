import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(12),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === "production" && !env.APP_ORIGIN.startsWith("https://"))
  throw new Error("APP_ORIGIN precisa usar HTTPS em produção.");
