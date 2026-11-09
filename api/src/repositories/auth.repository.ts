import { db } from "../config/database.js";

export const authRepository = {
  userByEmail: (email: string) => db.user.findUnique({ where: { email } }),

  sessionByHash: (token_hash: string) =>
    db.session.findUnique({ where: { token_hash } }),

  userById: (id: string) => db.user.findUnique({ where: { id } }),

  organization: (id: string) => db.organization.findUnique({ where: { id } }),

  agency: (id: string) => db.agency.findUnique({ where: { id } }),

  partner: (id: string) => db.partner.findUnique({ where: { id } }),
};
