import type { Role } from "@prisma/client";

export interface Context {
  user_id: string;
  organization_id: string;
  agency_id: string | null;
  partner_id: string | null;
  role: Role;
  session_id: string;
  ip_address?: string;
}

declare global {
  namespace Express {
    interface Request {
      context: Context;
      request_id: string;
    }
  }
}
