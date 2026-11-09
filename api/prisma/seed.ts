import "dotenv/config";
import argon2 from "argon2";
import { db } from "../src/config/database.js";
import { password as passwordSchema } from "../src/validators/common.js";

if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEMO_SEED !== "true"
)
  throw new Error(
    "Seed permitido somente em DEV/HML com ALLOW_DEMO_SEED=true.",
  );

const password = passwordSchema.parse(process.env.SEED_PASSWORD);

const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  agencyA: "00000000-0000-4000-8000-000000000002",
  agencyB: "00000000-0000-4000-8000-000000000003",
  partner: "00000000-0000-4000-8000-000000000004",
  residue: "00000000-0000-4000-8000-000000000005",
  partnerType: "00000000-0000-4000-8000-000000000006",
};

try {
  const password_hash = await argon2.hash(password, { type: argon2.argon2id });

  await db.$transaction(async (tx) => {
    const organization_id = ids.organization;

    await tx.organization.upsert({
      where: { id: organization_id },
      create: {
        id: organization_id,
        name: "Sicredi Ouro Verde MT/PA — Demonstração",
      },
      update: {},
    });

    for (const [id, code, name] of [
      [ids.agencyA, "DEMO-A", "Agência demonstração A"],
      [ids.agencyB, "DEMO-B", "Agência demonstração B"],
    ] as const) {
      await tx.agency.upsert({
        where: { id },
        create: { id, organization_id, code, name },
        update: {},
      });
    }

    await tx.partner.upsert({
      where: { id: ids.partner },
      create: {
        id: ids.partner,
        organization_id,
        name: "Parceiro demonstração",
      },
      update: {},
    });

    await tx.partnerType.upsert({
      where: { id: ids.partnerType },
      create: { id: ids.partnerType, organization_id, name: "Reciclagem" },
      update: {},
    });

    await tx.partnerTypeLink.upsert({
      where: {
        partner_id_partner_type_id: {
          partner_id: ids.partner,
          partner_type_id: ids.partnerType,
        },
      },
      create: {
        organization_id,
        partner_id: ids.partner,
        partner_type_id: ids.partnerType,
      },
      update: {},
    });

    await tx.agencyPartnerLink.upsert({
      where: {
        agency_id_partner_id: {
          agency_id: ids.agencyA,
          partner_id: ids.partner,
        },
      },
      create: {
        organization_id,
        agency_id: ids.agencyA,
        partner_id: ids.partner,
      },
      update: {},
    });

    await tx.residueType.upsert({
      where: { id: ids.residue },
      create: {
        id: ids.residue,
        organization_id,
        name: "Papel",
        color: "#228B22",
      },
      update: {},
    });

    const roles = [
      { email: "superadmin@demo.invalid", role: "super_admin" as const },
      {
        email: "admin.a@demo.invalid",
        role: "agency_admin" as const,
        agency_id: ids.agencyA,
      },
      {
        email: "colaborador.a@demo.invalid",
        role: "internal_employee" as const,
        agency_id: ids.agencyA,
      },
      {
        email: "admin.b@demo.invalid",
        role: "agency_admin" as const,
        agency_id: ids.agencyB,
      },
      {
        email: "admin.parceiro@demo.invalid",
        role: "partner_admin" as const,
        partner_id: ids.partner,
      },
      {
        email: "colaborador.parceiro@demo.invalid",
        role: "partner_employee" as const,
        partner_id: ids.partner,
      },
    ];

    for (const user of roles) {
      const existing = await tx.user.findUnique({
        where: { email: user.email },
      });

      if (existing && existing.organization_id !== organization_id)
        throw new Error(
          "E-mail de demonstração já pertence a outra organização.",
        );

      // Re-running the seed never resets passwords or existing master data.
      if (!existing)
        await tx.user.create({
          data: {
            ...user,
            organization_id,
            name: user.email.split("@")[0]!,
            password_hash,
          },
        });
    }
  });

  console.log(
    "Seed de demonstração concluído. Contas e IDs estão documentados no README; senhas não são exibidas.",
  );
} finally {
  await db.$disconnect();
}
