import { z } from "zod";
import {
  resourceSchemas,
  organizationSchema,
  profileSchema,
  changePasswordSchema,
} from "../validators/resources.validator.js";
import {
  weighingCreate,
  weighingPatch,
  cancellation,
} from "../validators/weighings.validator.js";
import { email } from "../validators/common.js";

type Json = Record<string, unknown>;

const paths: Record<string, Json> = {};

const body = (schema: z.ZodType) => ({
  required: true,
  content: {
    "application/json": {
      schema: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
    },
  },
});

const idParam = (name = "id") => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
});

const qParam = (name: string, type = "string", extra: Json = {}) => ({
  name,
  in: "query",
  schema: { type, ...extra },
});

const paging = [
  qParam("page", "integer", { minimum: 1, default: 1 }),
  qParam("page_size", "integer", { minimum: 1, maximum: 100, default: 20 }),
];

const weighingParams = [
  ...paging,
  ...[
    "start_date",
    "end_date",
    "agency_id",
    "residue_type_id",
    "registered_by",
    "destination_partner_id",
    "status",
    "sort",
  ].map((n) => qParam(n)),
];

function operation(
  summary: string,
  requestBody?: unknown,
  parameters: unknown[] = [],
  success = 200,
  auth = true,
): Json {
  return {
    summary,
    security: auth ? [{ sessionCookie: [] }] : [],
    parameters,
    ...(requestBody ? { requestBody } : {}),
    responses: {
      [success]: { description: "Sucesso" },
      "400": {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
        description: "Entrada inválida",
      },
      "401": { description: "Sessão inválida" },
      "403": { description: "Sem permissão ou CSRF inválido" },
      "404": { description: "Recurso fora do escopo ou inexistente" },
      "409": { description: "Conflito, duplicidade ou política pendente" },
      "429": { description: "Limite de requisições" },
    },
  };
}

paths["/auth/login"] = {
  post: operation(
    "Autenticar; retorna csrf_token e cookie HttpOnly",
    body(z.object({ email, password: z.string().min(1).max(128) }).strict()),
    [],
    200,
    false,
  ),
};

paths["/lookups/partners"] = {
  get: operation(
    "Opções de parceiros ativos para a pesagem; apenas ID, nome e status, sem documentos/contatos. Acesso interno no escopo da sessão.",
    undefined,
    [...paging, qParam("search")],
  ),
};

paths["/auth/logout"] = {
  post: operation("Revogar sessão", undefined, [], 204),
};

paths["/auth/csrf"] = {
  get: operation("Rotacionar e recuperar token CSRF da sessão"),
};

paths["/me"] = {
  get: operation("Identidade e permissões efetivas"),
  patch: operation("Atualizar nome do próprio usuário", body(profileSchema)),
};

paths["/me/password"] = {
  post: operation(
    "Trocar senha e revogar todas as sessões",
    body(changePasswordSchema),
    [],
    204,
  ),
};

paths["/organization"] = {
  get: operation("Organização atual; somente Super Admin"),
  patch: operation(
    "Manter organização; somente Super Admin",
    body(organizationSchema),
  ),
};

for (const [name, schema] of Object.entries(resourceSchemas)) {
  paths[`/${name}`] = {
    get: operation(`Listar ${name} no escopo`, undefined, [
      ...paging,
      qParam("search"),
    ]),
    post: operation(`Criar ${name} conforme perfil`, body(schema), [], 201),
  };

  paths[`/${name}/{id}`] = {
    get: operation(`Consultar ${name}`, undefined, [idParam()]),
    patch: operation(
      `Editar ${name}; status controla inativação`,
      body(schema.partial()),
      [idParam()],
    ),
  };
}

paths["/agencies/{id}/partners/{partnerId}"] = {
  put: operation(
    "Manter vínculo agência/parceiro",
    body(z.object({ status: z.enum(["active", "inactive"]) }).strict()),
    [idParam(), idParam("partnerId")],
  ),
};

paths["/partners/{id}/types/{typeId}"] = {
  put: operation(
    "Vincular ou desvincular tipo de parceiro",
    body(z.object({ enabled: z.boolean() }).strict()),
    [idParam(), idParam("typeId")],
  ),
};

paths["/weighings"] = {
  get: operation(
    "Histórico paginado; intervalo [start_date, end_date)",
    undefined,
    weighingParams,
  ),
  post: operation(
    "Registrar exatamente um saco",
    body(weighingCreate),
    [],
    201,
  ),
};

paths["/weighings/{id}"] = {
  get: operation("Consultar pesagem", undefined, [idParam()]),
  patch: operation(
    "Corrigir com controle de versão; depende da política confirmada",
    body(weighingPatch),
    [idParam()],
  ),
};

paths["/weighings/{id}/cancel"] = {
  post: operation(
    "Cancelar logicamente com versão e motivo; depende da política confirmada",
    body(cancellation),
    [idParam()],
  ),
};

paths["/weighings/{id}/audit-logs"] = {
  get: operation("Trilha da pesagem no escopo; acesso interno", undefined, [
    idParam(),
    ...paging,
  ]),
};

paths["/dashboard/summary"] = {
  get: operation(
    "Agregados de pesagens válidas e contadores do escopo",
    undefined,
    [
      ...weighingParams,
      qParam("period", "string", { enum: ["day", "week", "month"] }),
    ],
  ),
};

paths["/reports/weighings"] = {
  get: operation(
    "Relatório JSON paginado ou CSV completo em ordem de ID",
    undefined,
    [...weighingParams, qParam("format", "string", { enum: ["json", "csv"] })],
  ),
};

paths["/audit-logs"] = {
  get: operation("Auditoria do tenant; somente Super Admin", undefined, [
    ...paging,
    qParam("entity_type"),
    qParam("entity_id"),
  ]),
};

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Lixo Zero Sicredi API",
    version: "0.1.0",
    description:
      "Backend SaaS multiunidade. Todas as mutações autenticadas exigem X-CSRF-Token obtido no login ou em GET /auth/csrf. Campos desconhecidos são rejeitados. Pesos retornam como strings decimais. Campos de documento são opcionais, normalizados e únicos no tenant conforme política documentada. Consulte README e decisões de negócio antes de habilitar operações condicionais.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "session" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              fields: { type: "object" },
            },
          },
          request_id: { type: "string", format: "uuid" },
        },
      },
    },
  },
};

// Response contracts mirror the public DTOs; credentials are never response fields.
const uuidOutput = { type: "string", format: "uuid" };

const dateOutput = { type: "string", format: "date-time" };

const decimalOutput = { type: "string", pattern: "^\\d+(\\.\\d{1,3})?$" };

const paginationOutput = {
  type: "object",
  required: ["page", "page_size", "total"],
  properties: {
    page: { type: "integer" },
    page_size: { type: "integer" },
    total: { type: "integer" },
  },
};

const weighingOutput = {
  type: "object",
  required: [
    "id",
    "organization_id",
    "agency_id",
    "residue_type_id",
    "registered_by",
    "weight_kg",
    "weighed_at",
    "status",
    "version",
    "created_at",
    "updated_at",
  ],
  properties: {
    id: uuidOutput,
    organization_id: uuidOutput,
    agency_id: uuidOutput,
    residue_type_id: uuidOutput,
    registered_by: uuidOutput,
    destination_partner_id: { anyOf: [uuidOutput, { type: "null" }] },
    weight_kg: decimalOutput,
    weighed_at: dateOutput,
    notes: { type: ["string", "null"] },
    evidence_url: { type: ["string", "null"] },
    status: { type: "string", enum: ["active", "corrected", "cancelled"] },
    version: { type: "integer", minimum: 1 },
    created_at: dateOutput,
    updated_at: dateOutput,
  },
};

const metricsOutput = {
  type: "object",
  properties: {
    total_weight_kg: decimalOutput,
    weighing_count: { type: "integer" },
    average_weight_kg: decimalOutput,
  },
};

const pageOutput = (row: unknown) => ({
  type: "object",
  required: ["data", "pagination"],
  properties: {
    data: { type: "array", items: row },
    pagination: paginationOutput,
  },
});

function responseSchema(
  path: string,
  method: string,
  status: number,
  schema: unknown,
) {
  const op = paths[path]![method] as Json;
  const responses = op.responses as Record<string, Json>;

  responses[String(status)] = {
    description: "Sucesso",
    content: { "application/json": { schema } },
  };
}

responseSchema("/auth/login", "post", 200, {
  type: "object",
  required: ["csrf_token", "expires_at"],
  properties: { csrf_token: { type: "string" }, expires_at: dateOutput },
});

responseSchema("/auth/csrf", "get", 200, {
  type: "object",
  required: ["csrf_token"],
  properties: { csrf_token: { type: "string" } },
});

responseSchema("/weighings", "get", 200, pageOutput(weighingOutput));
responseSchema("/weighings", "post", 201, weighingOutput);

for (const method of ["get", "patch"])
  responseSchema("/weighings/{id}", method, 200, weighingOutput);

responseSchema("/weighings/{id}/cancel", "post", 200, weighingOutput);

responseSchema("/reports/weighings", "get", 200, {
  allOf: [
    pageOutput(weighingOutput),
    { type: "object", properties: { totals: metricsOutput } },
  ],
});

const reportResponse = (paths["/reports/weighings"]!.get as Json)
  .responses as Record<string, Json>;

(reportResponse["200"]!.content as Json)["text/csv"] = {
  schema: { type: "string" },
};

responseSchema("/dashboard/summary", "get", 200, {
  allOf: [
    metricsOutput,
    {
      type: "object",
      properties: {
        by_agency: {
          type: "array",
          items: {
            allOf: [
              metricsOutput,
              { type: "object", properties: { agency_id: uuidOutput } },
            ],
          },
        },
        by_residue_type: {
          type: "array",
          items: {
            allOf: [
              metricsOutput,
              { type: "object", properties: { residue_type_id: uuidOutput } },
            ],
          },
        },
        by_partner: {
          type: "array",
          items: {
            allOf: [
              metricsOutput,
              {
                type: "object",
                properties: { destination_partner_id: uuidOutput },
              },
            ],
          },
        },
        by_period: {
          type: "array",
          items: {
            allOf: [
              metricsOutput,
              { type: "object", properties: { period: dateOutput } },
            ],
          },
        },
        latest: { type: "array", items: weighingOutput },
        counts: {
          type: "object",
          properties: {
            agencies: { type: "integer" },
            users: { type: "integer" },
            partners: { type: "integer" },
          },
        },
        timezone: { type: "string", const: "UTC" },
        period: { type: "string", enum: ["day", "week", "month"] },
      },
    },
  ],
});

for (const [name, schema] of Object.entries(resourceSchemas)) {
  const model = z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
  }) as Json;

  const properties = { ...(model.properties as Json) };

  delete properties.password;
  delete properties.agency_ids;
  delete properties.partner_type_ids;

  if (name === "users") delete properties.cpf;

  const row = {
    type: "object",
    properties: {
      ...properties,
      id: uuidOutput,
      organization_id: uuidOutput,
      created_at: dateOutput,
      updated_at: dateOutput,
    },
    required: [
      "id",
      "organization_id",
      "name",
      "status",
      "created_at",
      "updated_at",
    ],
  };

  responseSchema(`/${name}`, "get", 200, pageOutput(row));
  responseSchema(`/${name}`, "post", 201, row);
  responseSchema(`/${name}/{id}`, "get", 200, row);
  responseSchema(`/${name}/{id}`, "patch", 200, row);
}

for (const path of Object.values(paths)) {
  for (const [method, value] of Object.entries(path)) {
    if (method === "get") continue;

    const op = value as Json;

    if (Array.isArray(op.security) && op.security.length) {
      op.parameters = [
        ...(op.parameters as unknown[]),
        {
          name: "X-CSRF-Token",
          in: "header",
          required: true,
          schema: { type: "string" },
        },
      ];
    }
  }
}
