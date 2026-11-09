import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const secret = () => randomBytes(32).toString("base64url");

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function matchesHash(value: string, hash: string) {
  const actual = Buffer.from(digest(value), "hex");
  const expected = Buffer.from(hash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
