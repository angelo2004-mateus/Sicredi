import { beforeAll, afterAll, describe, test, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { Role } from "@prisma/client";
import { app } from "../../src/app.js";
import { db } from "../../src/config/database.js";
import { businessPolicy } from "../../src/policies/access.js";
import { csvCell } from "../../src/services/reports.service.js";

const database = new URL(process.env.DATABASE_URL ?? "");

if (process.env.NODE_ENV !== "test" || !database.pathname.endsWith("_test"))
  throw new Error("Use NODE_ENV=test e banco com sufixo _test.");

const password = "integration-password-123";

const ids = {
  org: randomUUID(),
  otherOrg: randomUUID(),
  a: randomUUID(),
  b: randomUUID(),
  foreignAgency: randomUUID(),
  residue: randomUUID(),
  foreignResidue: randomUUID(),
  inactiveResidue: randomUUID(),
  partner: randomUUID(),
  otherPartner: randomUUID(),
  foreignPartner: randomUUID(),
  type: randomUUID(),
};

type Auth = { cookie: string; csrf: string; id: string; email: string };

const auth: Record<string, Auth> = {};

let weighingA: string;
let weighingB: string;
let createdPartner: string;

const originals = { ...businessPolicy };

async function signIn(email: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });

  expect(response.status).toBe(200);

  const cookies = response.headers["set-cookie"] as unknown as string[];

  return {
    cookie: cookies[0]!.split(";")[0]!,
    csrf: response.body.csrf_token as string,
  };
}

function api(
  user: string,
  method: "get" | "post" | "patch" | "put",
  path: string,
  body?: unknown,
) {
  const identity = auth[user]!;

  const call = request(app)
    [method]("/api/v1" + path)
    .set("Cookie", identity.cookie)
    .set("X-CSRF-Token", identity.csrf);

  return body === undefined ? call : call.send(body);
}

const payload = (extra: Record<string, unknown> = {}) => ({
  residue_type_id: ids.residue,
  weight_kg: 8.75,
  ...extra,
});

beforeAll(async () => {
  const password_hash = await argon2.hash(password);

  await db.organization.createMany({
    data: [
      { id: ids.org, name: "Teste organização" },
      { id: ids.otherOrg, name: "Teste organização externa" },
    ],
  });

  await db.agency.createMany({
    data: [
      { id: ids.a, organization_id: ids.org, name: "Agência A", code: "A" },
      { id: ids.b, organization_id: ids.org, name: "Agência B", code: "B" },
      {
        id: ids.foreignAgency,
        organization_id: ids.otherOrg,
        name: "Externa",
        code: "A",
      },
    ],
  });

  await db.residueType.createMany({
    data: [
      { id: ids.residue, organization_id: ids.org, name: "Papel" },
      {
        id: ids.inactiveResidue,
        organization_id: ids.org,
        name: "Inativo",
        status: "inactive",
      },
      { id: ids.foreignResidue, organization_id: ids.otherOrg, name: "Papel" },
    ],
  });

  await db.partner.createMany({
    data: [
      { id: ids.partner, organization_id: ids.org, name: "Parceiro A" },
      { id: ids.otherPartner, organization_id: ids.org, name: "Parceiro B" },
      {
        id: ids.foreignPartner,
        organization_id: ids.otherOrg,
        name: "Parceiro externo",
      },
    ],
  });

  await db.partnerType.create({
    data: { id: ids.type, organization_id: ids.org, name: "Reciclador" },
  });

  await db.agencyPartnerLink.create({
    data: {
      organization_id: ids.org,
      agency_id: ids.a,
      partner_id: ids.partner,
    },
  });

  const users: Array<[string, Role, string | null, string | null, string]> = [
    ["super", "super_admin", null, null, ids.org],
    ["adminA", "agency_admin", ids.a, null, ids.org],
    ["adminB", "agency_admin", ids.b, null, ids.org],
    ["employee", "internal_employee", ids.a, null, ids.org],
    ["partnerAdmin", "partner_admin", null, ids.partner, ids.org],
    ["partnerEmployee", "partner_employee", null, ids.partner, ids.org],
    ["foreign", "super_admin", null, null, ids.otherOrg],
  ];

  for (const [name, role, agency_id, partner_id, organization_id] of users) {
    const email = `${name}.${ids.org}@test.invalid`.toLowerCase();

    const user = await db.user.create({
      data: {
        organization_id,
        agency_id,
        partner_id,
        role,
        email,
        name,
        password_hash,
      },
    });

    auth[name] = { ...(await signIn(email)), id: user.id, email };
  }
});

afterAll(async () => {
  Object.assign(businessPolicy, originals);
  await db.$disconnect();
});

describe("Sessão e segurança HTTP", () => {
  test("healthchecks e OpenAPI públicos", async () => {
    expect((await request(app).get("/health/live")).status).toBe(200);
    expect((await request(app).get("/health/ready")).status).toBe(200);

    const spec = await request(app).get("/api/v1/openapi.json");

    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/weighings"].post.requestBody).toBeDefined();
  });

  test("nega sessão ausente, origem estranha e CSRF ausente", async () => {
    expect((await request(app).get("/api/v1/me")).status).toBe(401);

    expect(
      (
        await api("employee", "post", "/weighings", payload()).set(
          "Origin",
          "https://evil.invalid",
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await request(app)
          .post("/api/v1/weighings")
          .set("Cookie", auth.employee!.cookie)
          .send(payload())
      ).status,
    ).toBe(403);
  });

  test("identidade não expõe hash, CPF ou segredo de sessão", async () => {
    const r = await api("super", "get", "/me");

    expect(r.status).toBe(200);
    expect(r.body.permissions.manage_agencies).toBe(true);
    expect(r.body.password_hash).toBeUndefined();
    expect(r.body.cpf).toBeUndefined();
  });

  test("erros de credencial são genéricos", async () => {
    const r = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: auth.super!.email, password: "wrong" });

    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(r.body.request_id).toBeDefined();
  });

  test("rotação de CSRF invalida token anterior", async () => {
    const old = auth.employee!.csrf;
    const r = await api("employee", "get", "/auth/csrf");

    expect(r.status).toBe(200);
    auth.employee!.csrf = r.body.csrf_token;

    expect(
      (
        await api("employee", "post", "/weighings", payload()).set(
          "X-CSRF-Token",
          old,
        )
      ).status,
    ).toBe(403);
  });
});

describe("Cadastros e relações entre tenants", () => {
  test("Super Admin cria agência e duplicidade vira 409", async () => {
    const input = { name: "Nova", code: "NEW" };

    expect((await api("super", "post", "/agencies", input)).status).toBe(201);
    expect((await api("super", "post", "/agencies", input)).status).toBe(409);

    expect(
      (await api("adminA", "post", "/agencies", { name: "Negada", code: "NO" }))
        .status,
    ).toBe(403);
  });

  test("lista e detalhe limitam agência e organização", async () => {
    const list = await api("adminA", "get", "/agencies");

    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([ids.a]);
    expect((await api("adminA", "get", `/agencies/${ids.b}`)).status).toBe(404);
    expect(
      (await api("super", "get", `/agencies/${ids.foreignAgency}`)).status,
    ).toBe(404);
    expect(
      (await api("foreign", "get", `/partners/${ids.partner}`)).status,
    ).toBe(404);
  });

  test("Admin Agência cria colaborador e não eleva perfil nem troca escopo", async () => {
    const input = {
      name: "Novo usuário",
      email: `${randomUUID()}@test.invalid`,
      password,
      role: "internal_employee",
    };

    const created = await api("adminA", "post", "/users", input);

    expect(created.status).toBe(201);
    expect(created.body.agency_id).toBe(ids.a);
    expect(created.body.password_hash).toBeUndefined();

    expect(
      (
        await api("adminA", "patch", `/users/${created.body.id}`, {
          role: "super_admin",
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await api("adminA", "post", "/users", {
          ...input,
          email: `${randomUUID()}@test.invalid`,
          agency_id: ids.b,
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await api("adminA", "patch", `/users/${auth.adminB!.id}`, {
          name: "Ataque",
        })
      ).status,
    ).toBe(404);
  });

  test("administrador parceiro cria somente colaborador do próprio parceiro", async () => {
    const input = {
      name: "Externo",
      email: `${randomUUID()}@test.invalid`,
      password,
      role: "partner_employee",
    };

    const r = await api("partnerAdmin", "post", "/users", input);

    expect(r.status).toBe(201);
    expect(r.body.partner_id).toBe(ids.partner);

    expect(
      (
        await api("partnerAdmin", "post", "/users", {
          ...input,
          email: `${randomUUID()}@test.invalid`,
          partner_id: ids.otherPartner,
        })
      ).status,
    ).toBe(403);

    expect((await api("partnerEmployee", "post", "/users", input)).status).toBe(
      403,
    );
  });

  test("referências de usuário de outra organização são negadas", async () => {
    const r = await api("super", "post", "/users", {
      name: "Invasor",
      email: `${randomUUID()}@test.invalid`,
      password,
      role: "internal_employee",
      agency_id: ids.foreignAgency,
    });

    expect(r.status).toBe(404);
  });

  test("parceiro criado na agência recebe vínculo; master compartilhado exige Super Admin", async () => {
    const r = await api("adminA", "post", "/partners", {
      name: "Parceiro criado localmente",
    });

    expect(r.status).toBe(201);
    createdPartner = r.body.id;

    const detail = await api("adminA", "get", `/partners/${createdPartner}`);

    expect(detail.body.agency_links[0].agency_id).toBe(ids.a);
    expect(
      (await api("adminB", "get", `/partners/${createdPartner}`)).status,
    ).toBe(404);

    expect(
      (
        await api("adminA", "patch", `/partners/${createdPartner}`, {
          name: "Não",
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await api("super", "patch", `/partners/${createdPartner}`, {
          name: "Editado",
        })
      ).status,
    ).toBe(200);
  });

  test("vínculos e tipos não atravessam tenants", async () => {
    expect(
      (
        await api(
          "super",
          "put",
          `/agencies/${ids.a}/partners/${ids.foreignPartner}`,
          { status: "active" },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await api(
          "adminA",
          "put",
          `/agencies/${ids.b}/partners/${ids.partner}`,
          { status: "active" },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await api(
          "super",
          "put",
          `/partners/${ids.partner}/types/${ids.type}`,
          { enabled: true },
        )
      ).status,
    ).toBe(200);

    const partner = await api("super", "get", `/partners/${ids.partner}`);

    expect(partner.body.type_links).toHaveLength(1);
  });

  test("tipos de resíduos e parceiros têm manutenção central e status", async () => {
    const residue = await api("super", "post", "/residue-types", {
      name: "Plástico",
      color: "#223344",
    });

    expect(residue.status).toBe(201);

    expect(
      (
        await api("super", "patch", `/residue-types/${residue.body.id}`, {
          status: "inactive",
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await api("employee", "post", "/residue-types", {
          name: "Não permitido",
        })
      ).status,
    ).toBe(403);

    expect(
      (await api("super", "post", "/partner-types", { name: "Compostagem" }))
        .status,
    ).toBe(201);
  });

  test("campos desconhecidos, payload vazio e IDs inválidos são rejeitados", async () => {
    expect(
      (
        await api("super", "post", "/agencies", {
          name: "A",
          code: "INVALID",
          organization_id: ids.otherOrg,
        })
      ).status,
    ).toBe(400);

    expect((await api("super", "patch", `/agencies/${ids.a}`, {})).status).toBe(
      400,
    );
    expect((await api("super", "get", "/users/not-a-uuid")).status).toBe(400);
  });

  test("constraints SQL barram vínculo cruzado mesmo sem passar pela API", async () => {
    await expect(
      db.agencyPartnerLink.create({
        data: {
          organization_id: ids.org,
          agency_id: ids.a,
          partner_id: ids.foreignPartner,
        },
      }),
    ).rejects.toThrow();

    await expect(
      db.wasteBagWeighing.create({
        data: {
          organization_id: ids.org,
          agency_id: ids.a,
          residue_type_id: ids.foreignResidue,
          registered_by: auth.employee!.id,
          weight_kg: 1,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("Pesagem e histórico", () => {
  test("registra um saco usando agência, autor e horário do servidor", async () => {
    const started = Date.now();

    const r = await api(
      "employee",
      "post",
      "/weighings",
      payload({ destination_partner_id: ids.partner }),
    );

    expect(r.status).toBe(201);
    weighingA = r.body.id;
    expect(r.body.weight_kg).toBe("8.75");
    expect(r.body.agency_id).toBe(ids.a);
    expect(r.body.registered_by).toBe(auth.employee!.id);
    expect(new Date(r.body.weighed_at).getTime()).toBeGreaterThanOrEqual(
      started,
    );

    const a = await api(
      "employee",
      "get",
      `/weighings/${weighingA}/audit-logs`,
    );

    expect(a.body.data[0].action).toBe("create");
  });

  test.each([0, -1, "1.1234", "0.000", "10000000", "NaN", "1e3"])(
    "rejeita peso inválido %s",
    async (weight_kg) => {
      expect(
        (await api("employee", "post", "/weighings", payload({ weight_kg })))
          .status,
      ).toBe(400);
    },
  );

  test("rejeita tipos inativos, externos, parceiro externo e mudança de autoria", async () => {
    for (const extra of [
      { residue_type_id: ids.inactiveResidue },
      { residue_type_id: ids.foreignResidue },
      { destination_partner_id: ids.foreignPartner },
      { registered_by: auth.super!.id },
    ]) {
      expect(
        (await api("employee", "post", "/weighings", payload(extra))).status,
      ).toBe(400);
    }
  });

  test("colaborador não pode alterar agência nem data; parceiro não registra", async () => {
    expect(
      (
        await api(
          "employee",
          "post",
          "/weighings",
          payload({ agency_id: ids.b }),
        )
      ).status,
    ).toBe(403);

    expect(
      (
        await api(
          "employee",
          "post",
          "/weighings",
          payload({ weighed_at: new Date().toISOString() }),
        )
      ).status,
    ).toBe(403);

    expect(
      (await api("partnerAdmin", "post", "/weighings", payload())).status,
    ).toBe(403);
  });

  test("Super Admin seleciona agência e pode informar data", async () => {
    const r = await api(
      "super",
      "post",
      "/weighings",
      payload({
        agency_id: ids.b,
        weight_kg: "2.125",
        weighed_at: "2026-11-02T19:40:00-04:00",
      }),
    );

    expect(r.status).toBe(201);
    weighingB = r.body.id;
    expect(r.body.weighed_at).toBe("2026-11-02T23:40:00.000Z");
    expect((await api("super", "post", "/weighings", payload())).status).toBe(
      400,
    );
  });

  test("histórico e consultas diretas não cruzam agência/tenant", async () => {
    const a = await api("adminA", "get", "/weighings");

    expect(a.body.data).toHaveLength(1);
    expect(a.body.data[0].id).toBe(weighingA);
    expect((await api("adminA", "get", `/weighings/${weighingB}`)).status).toBe(
      404,
    );
    expect(
      (await api("foreign", "get", `/weighings/${weighingA}`)).status,
    ).toBe(404);
    expect(
      (await api("adminA", "get", `/weighings?agency_id=${ids.b}`)).status,
    ).toBe(403);
    expect(
      (await api("adminA", "get", `/weighings/${weighingB}/audit-logs`)).status,
    ).toBe(404);
  });

  test("filtros têm paginação, ordenação e fim de período exclusivo", async () => {
    const r = await api(
      "super",
      "get",
      `/weighings?start_date=2026-11-02T23:40:00Z&end_date=2026-11-02T23:40:01Z&residue_type_id=${ids.residue}&page_size=1&sort=weight_kg`,
    );

    expect(r.status).toBe(200);
    expect(r.body.data[0].id).toBe(weighingB);
    expect(
      (await api("super", "get", "/weighings?page_size=10000")).status,
    ).toBe(400);
    expect(
      (await api("super", "get", "/weighings?sort=DROP_TABLE")).status,
    ).toBe(400);
  });

  test("falha na auditoria reverte a pesagem inteira", async () => {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.after_data->>'weight_kg' = '9.999' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER test_reject_audit_trigger BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_audit()`,
    );

    try {
      const before = await db.wasteBagWeighing.count({
        where: { organization_id: ids.org },
      });

      expect(
        (
          await api(
            "employee",
            "post",
            "/weighings",
            payload({ weight_kg: "9.999" }),
          )
        ).status,
      ).toBe(500);

      expect(
        await db.wasteBagWeighing.count({
          where: { organization_id: ids.org },
        }),
      ).toBe(before);
    } finally {
      await db.$executeRawUnsafe(
        "DROP TRIGGER test_reject_audit_trigger ON audit_logs",
      );
      await db.$executeRawUnsafe("DROP FUNCTION test_reject_audit()");
    }
  });
});

describe("Indicadores, relatórios e políticas condicionais", () => {
  test("dashboard calcula peso, quantidade e média por escopo com precisão decimal", async () => {
    const r = await api("super", "get", "/dashboard/summary");

    expect(r.status).toBe(200);
    expect(r.body.total_weight_kg).toBe("10.875");
    expect(r.body.weighing_count).toBe(2);
    expect(r.body.average_weight_kg).toBe("5.438");
    expect(r.body.by_agency).toHaveLength(2);
    expect(r.body.by_partner).toHaveLength(1);

    const a = await api("adminA", "get", "/dashboard/summary");

    expect(a.body.total_weight_kg).toBe("8.750");

    expect(
      (await api("adminA", "get", `/dashboard/summary?agency_id=${ids.b}`))
        .status,
    ).toBe(403);
  });

  test("CSV contém todos os registros do escopo; proteção contra fórmula", async () => {
    const r = await api("adminA", "get", "/reports/weighings?format=csv");

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("text/csv");
    expect(r.text).toContain(weighingA);
    expect(r.text).not.toContain(weighingB);
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  test("auditoria global é só do Super Admin e permanece no tenant", async () => {
    expect((await api("adminA", "get", "/audit-logs")).status).toBe(403);

    const r = await api("super", "get", "/audit-logs");

    expect(r.status).toBe(200);

    expect(
      r.body.data.every(
        (row: { organization_id: string }) => row.organization_id === ids.org,
      ),
    ).toBe(true);

    expect(JSON.stringify(r.body)).not.toContain("password_hash");

    await expect(
      db.auditLog.updateMany({
        where: { organization_id: ids.org },
        data: { action: "tamper" },
      }),
    ).rejects.toThrow();
  });

  test("políticas indefinidas ficam bloqueadas explicitamente", async () => {
    Object.assign(businessPolicy, {
      confirmed: false,
      partnerReadEnabled: false,
    });

    expect(
      (
        await api("employee", "patch", `/weighings/${weighingA}`, {
          version: 1,
          weight_kg: 9,
        })
      ).body.error.code,
    ).toBe("BUSINESS_POLICY_PENDING");

    expect((await api("partnerAdmin", "get", "/weighings")).status).toBe(403);
  });

  test("política candidata em ambiente de teste: correção preserva totais e versão", async () => {
    Object.assign(businessPolicy, {
      confirmed: true,
      includeCorrectedInTotals: true,
      partnerReadEnabled: true,
    });

    const r = await api("employee", "patch", `/weighings/${weighingA}`, {
      version: 1,
      weight_kg: "9.125",
    });

    expect(r.status).toBe(200);
    expect(r.body.status).toBe("corrected");
    expect(r.body.version).toBe(2);

    expect(
      (
        await api("employee", "patch", `/weighings/${weighingA}`, {
          version: 1,
          weight_kg: 7,
        })
      ).status,
    ).toBe(409);

    expect(
      (await api("adminA", "get", "/dashboard/summary")).body.total_weight_kg,
    ).toBe("9.125");

    const audit = await api(
      "employee",
      "get",
      `/weighings/${weighingA}/audit-logs`,
    );

    const correction = audit.body.data.find(
      (e: { action: string }) => e.action === "correct",
    );

    expect(correction.before_data.weight_kg).toBe("8.75");
    expect(correction.after_data.weight_kg).toBe("9.125");
  });

  test("política candidata: consulta de parceiro é restrita ao destino e não permite escrita", async () => {
    const r = await api("partnerAdmin", "get", "/weighings");

    expect(r.status).toBe(200);
    expect(r.body.data.map((row: { id: string }) => row.id)).toEqual([
      weighingA,
    ]);
    expect(
      (await api("partnerEmployee", "get", `/weighings/${weighingB}`)).status,
    ).toBe(404);

    expect(
      (
        await api("partnerAdmin", "patch", `/weighings/${weighingA}`, {
          version: 2,
          weight_kg: 2,
        })
      ).status,
    ).toBe(403);

    expect(
      (await api("partnerAdmin", "get", "/dashboard/summary")).status,
    ).toBe(403);
  });

  test("política candidata: cancelamento lógico retira peso e audita uma única vez", async () => {
    expect(
      (
        await api("employee", "post", `/weighings/${weighingA}/cancel`, {
          version: 2,
          reason: "Duplicado",
        })
      ).status,
    ).toBe(403);

    const r = await api("adminA", "post", `/weighings/${weighingA}/cancel`, {
      version: 2,
      reason: "Lançamento incorreto",
    });

    expect(r.status).toBe(200);
    expect(r.body.status).toBe("cancelled");
    expect(
      (await api("adminA", "get", "/dashboard/summary")).body.weighing_count,
    ).toBe(0);
    expect(
      (await api("super", "get", "/dashboard/summary")).body.total_weight_kg,
    ).toBe("2.125");

    const report = await api("super", "get", "/reports/weighings");

    expect(report.body.totals.total_weight_kg).toBe("2.125");
    expect(report.body.data.map((row: { id: string }) => row.id)).not.toContain(
      weighingA,
    );

    const cancelledReport = await api(
      "adminA",
      "get",
      "/reports/weighings?status=cancelled",
    );

    expect(cancelledReport.body.totals.total_weight_kg).toBe("9.125");

    expect(
      (
        await api("adminA", "post", `/weighings/${weighingA}/cancel`, {
          version: 2,
          reason: "Repetição",
        })
      ).status,
    ).toBe(200);

    expect(
      await db.auditLog.count({
        where: {
          organization_id: ids.org,
          entity_id: weighingA,
          action: "cancel",
        },
      }),
    ).toBe(1);

    expect(
      (
        await api("employee", "patch", `/weighings/${weighingA}`, {
          version: 3,
          weight_kg: 2,
        })
      ).status,
    ).toBe(409);

    Object.assign(businessPolicy, originals);
  });
});

describe("Concorrência e janela da política candidata", () => {
  test("duas correções com a mesma versão não sobrescrevem uma à outra", async () => {
    Object.assign(businessPolicy, {
      confirmed: true,
      includeCorrectedInTotals: true,
    });

    try {
      const created = await api(
        "employee",
        "post",
        "/weighings",
        payload({ weight_kg: "1.000" }),
      );

      const path = `/weighings/${created.body.id}`;

      const results = await Promise.all([
        api("employee", "patch", path, { version: 1, weight_kg: "2.000" }),
        api("employee", "patch", path, { version: 1, weight_kg: "3.000" }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

      const current = await api("employee", "get", path);

      expect(current.body.version).toBe(2);

      expect(
        await db.auditLog.count({
          where: { entity_id: created.body.id, action: "correct" },
        }),
      ).toBe(1);
    } finally {
      Object.assign(businessPolicy, originals);
    }
  });

  test("colaborador não corrige fora da janela, administrador da agência pode corrigir", async () => {
    Object.assign(businessPolicy, {
      confirmed: true,
      includeCorrectedInTotals: true,
    });

    try {
      const created = await api(
        "employee",
        "post",
        "/weighings",
        payload({ weight_kg: "1.000" }),
      );

      await db.wasteBagWeighing.update({
        where: { id: created.body.id },
        data: { created_at: new Date(Date.now() - 25 * 3600000) },
      });

      const path = `/weighings/${created.body.id}`;

      expect(
        (await api("employee", "patch", path, { version: 1, weight_kg: 2 }))
          .status,
      ).toBe(403);

      expect(
        (await api("adminB", "patch", path, { version: 1, weight_kg: 2 }))
          .status,
      ).toBe(404);

      expect(
        (await api("adminA", "patch", path, { version: 1, weight_kg: 2 }))
          .status,
      ).toBe(200);
    } finally {
      Object.assign(businessPolicy, originals);
    }
  });
});

describe("Permissões dos cadastros e vínculos de parceiros", () => {
  test("/me informa ações de cadastro e roles atribuíveis para os cinco perfis", async () => {
    const cases = [
      [
        "super",
        [
          "super_admin",
          "agency_admin",
          "internal_employee",
          "partner_admin",
          "partner_employee",
        ],
        true,
        true,
      ],
      ["adminA", ["internal_employee"], false, true],
      ["employee", [], false, false],
      ["partnerAdmin", ["partner_employee"], false, false],
      ["partnerEmployee", [], false, false],
    ] as const;

    for (const [name, roles, manageAgencies, createPartners] of cases) {
      const response = await api(name, "get", "/me");

      expect(response.status).toBe(200);
      expect(response.body.permissions.assignable_user_roles).toEqual(roles);
      expect(response.body.permissions.resources.agencies.create).toBe(
        manageAgencies,
      );
      expect(response.body.permissions.resources.partners.create).toBe(
        createPartners,
      );
      expect(response.body.permissions.resources.users.create).toBe(
        roles.length > 0,
      );
    }
  });

  test("colaborador interno não acessa o cadastro de parceiros; seleção da pesagem expõe só nomes e IDs", async () => {
    expect((await api("employee", "get", "/partners")).status).toBe(403);
    expect(
      (await api("employee", "get", `/partners/${ids.partner}`)).status,
    ).toBe(403);

    const response = await api("employee", "get", "/lookups/partners");

    expect(response.status).toBe(200);
    expect(
      response.body.data.some((row: { id: string }) => row.id === ids.partner),
    ).toBe(true);
    expect(
      response.body.data.some(
        (row: { id: string }) =>
          row.id === ids.otherPartner || row.id === ids.foreignPartner,
      ),
    ).toBe(false);
    expect(
      response.body.data.every(
        (row: Record<string, unknown>) =>
          Object.keys(row).sort().join(",") === "id,name,status",
      ),
    ).toBe(true);
    expect((await api("partnerAdmin", "get", "/lookups/partners")).status).toBe(
      403,
    );
  });

  test("cadastro central de parceiro salva agências e tipos na mesma transação", async () => {
    const response = await api("super", "post", "/partners", {
      name: "Parceiro vinculado pelo formulário",
      agency_ids: [ids.a, ids.b],
      partner_type_ids: [ids.type],
    });

    expect(response.status).toBe(201);
    expect(response.body.agency_links).toHaveLength(2);
    expect(response.body.type_links).toHaveLength(1);
    expect(
      (await api("adminB", "get", `/partners/${response.body.id}`)).status,
    ).toBe(200);
  });

  test("referência externa invalida todo o cadastro sem gravar parceiro ou auditoria", async () => {
    const before = await db.partner.count({
      where: { organization_id: ids.org },
    });

    const response = await api("super", "post", "/partners", {
      name: "Parceiro que não deve ser salvo",
      agency_ids: [ids.a, ids.foreignAgency],
      partner_type_ids: [ids.type],
    });

    expect(response.status).toBe(400);
    expect(
      await db.partner.count({ where: { organization_id: ids.org } }),
    ).toBe(before);
    expect(
      await db.auditLog.count({
        where: {
          organization_id: ids.org,
          after_data: {
            path: ["name"],
            equals: "Parceiro que não deve ser salvo",
          },
        },
      }),
    ).toBe(0);
  });

  test("administrador da agência não pode atribuir agências/tipos pelo payload", async () => {
    const response = await api("adminA", "post", "/partners", {
      name: "Tentativa de ampliar escopo",
      agency_ids: [ids.b],
      partner_type_ids: [],
    });

    expect(response.status).toBe(403);
    expect(
      (
        await api("super", "post", "/partners", {
          name: "Vínculos repetidos",
          agency_ids: [ids.a, ids.a],
        })
      ).status,
    ).toBe(400);
  });

  test("edição central altera vínculos logicamente e uma falha reverte todos os campos", async () => {
    const created = await api("super", "post", "/partners", {
      name: "Parceiro original",
      agency_ids: [ids.a, ids.b],
      partner_type_ids: [ids.type],
    });
    const id = created.body.id;

    const failed = await api("super", "patch", `/partners/${id}`, {
      name: "Nome inválido pela transação",
      agency_ids: [ids.b],
      partner_type_ids: [randomUUID()],
    });

    expect(failed.status).toBe(400);

    const unchanged = await api("super", "get", `/partners/${id}`);

    expect(unchanged.body.name).toBe("Parceiro original");
    expect(
      unchanged.body.agency_links.filter(
        (link: { status: string }) => link.status === "active",
      ),
    ).toHaveLength(2);

    const updated = await api("super", "patch", `/partners/${id}`, {
      name: "Parceiro atualizado",
      agency_ids: [ids.a],
      partner_type_ids: [],
    });

    expect(updated.status).toBe(200);
    expect(
      updated.body.agency_links.find(
        (link: { agency_id: string }) => link.agency_id === ids.b,
      ).status,
    ).toBe("inactive");
    expect(updated.body.type_links).toHaveLength(0);
    expect((await api("adminB", "get", `/partners/${id}`)).status).toBe(404);

    const audit = await db.auditLog.findFirstOrThrow({
      where: { organization_id: ids.org, entity_id: id, action: "update" },
    });

    expect(audit.before_data).toHaveProperty("agency_links");
    expect(audit.after_data).toHaveProperty("agency_links");
  });

  test("edição preserva vínculo existente com agência inativa, mas não cria novo vínculo inativo", async () => {
    const agency = await api("super", "post", "/agencies", {
      name: "Agência de vínculo",
      code: "LINK-INACTIVE",
    });
    const partner = await api("super", "post", "/partners", {
      name: "Parceiro com histórico",
      agency_ids: [agency.body.id],
    });

    expect(
      (
        await api("super", "patch", `/agencies/${agency.body.id}`, {
          status: "inactive",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("super", "patch", `/partners/${partner.body.id}`, {
          name: "Nome alterado",
          agency_ids: [agency.body.id],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("super", "post", "/partners", {
          name: "Novo vínculo inválido",
          agency_ids: [agency.body.id],
        })
      ).status,
    ).toBe(400);
  });
});

describe("Perfil e revogação", () => {
  test("alterar nome só afeta o próprio usuário", async () => {
    expect(
      (await api("employee", "patch", "/me", { name: "Nome atualizado" }))
        .status,
    ).toBe(200);

    expect(
      (await api("employee", "patch", "/me", { role: "super_admin" })).status,
    ).toBe(400);
  });

  test("troca de senha revoga todas as sessões; logout também revoga", async () => {
    const changed = await api("employee", "post", "/me/password", {
      current_password: password,
      new_password: "new-integration-password",
    });

    expect(changed.status).toBe(204);
    expect((await api("employee", "get", "/me")).status).toBe(401);
    expect((await api("adminB", "post", "/auth/logout", {})).status).toBe(204);
    expect((await api("adminB", "get", "/me")).status).toBe(401);
  });

  test("inativar usuário ou organização interrompe o acesso existente", async () => {
    expect(
      (
        await api("super", "patch", `/users/${auth.partnerEmployee!.id}`, {
          status: "inactive",
        })
      ).status,
    ).toBe(200);

    expect((await api("partnerEmployee", "get", "/me")).status).toBe(401);

    expect(
      (await api("foreign", "patch", "/organization", { status: "inactive" }))
        .status,
    ).toBe(200);

    expect((await api("foreign", "get", "/me")).status).toBe(401);
  });
});
