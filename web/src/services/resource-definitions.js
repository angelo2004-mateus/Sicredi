export const resourceDefinitions = {
  agencies: {
    singular: "agência",
    fields: [
      { name: "code", label: "Código", required: true },
      { name: "name", label: "Nome", required: true },
      { name: "cnpj", label: "CNPJ", maxLength: 18 },
      { name: "address", label: "Endereço" },
      { name: "city", label: "Cidade" },
      { name: "state", label: "UF", maxLength: 2 },
      { name: "region", label: "Região" },
      { name: "technical_responsible", label: "Responsável técnico" },
    ],
  },

  partners: {
    singular: "parceiro",
    fields: [
      { name: "name", label: "Razão social / nome", required: true },
      { name: "trade_name", label: "Nome fantasia" },
      { name: "cnpj", label: "CNPJ", maxLength: 18 },
      { name: "phone", label: "Telefone", type: "tel" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Endereço" },
      { name: "city", label: "Cidade" },
      { name: "state", label: "UF", maxLength: 2 },
    ],
  },

  users: {
    singular: "usuário",
    fields: [
      { name: "name", label: "Nome", required: true },
      {
        name: "email",
        label: "E-mail",
        type: "email",
        required: true,
        maxLength: 254,
      },
    ],
  },

  "partner-types": {
    singular: "tipo de parceiro",
    fields: [
      { name: "name", label: "Nome", required: true },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        maxLength: 2000,
      },
    ],
  },

  "residue-types": {
    singular: "tipo de resíduo",
    fields: [
      { name: "name", label: "Nome", required: true },
      {
        name: "description",
        label: "Descrição",
        type: "textarea",
        maxLength: 2000,
      },
      {
        name: "color",
        label: "Cor (hexadecimal)",
        placeholder: "Ex.: #228B22",
        pattern: "#[a-fA-F0-9]{6}",
        maxLength: 7,
      },
      { name: "default_destination", label: "Destinação padrão" },
    ],
  },
};

export function canEditResource(user, resource, row) {
  if (!user.permissions.resources?.[resource]?.update) return false;

  if (resource !== "users") return true;

  return (
    row.id !== user.id &&
    user.permissions.assignable_user_roles.includes(row.role)
  );
}

export function roleScopeDescription(role) {
  if (role === "super_admin")
    return "Acesso a todas as agências da organização e aos cadastros administrativos.";

  if (role === "agency_admin")
    return "Administra usuários e registros somente da agência vinculada.";

  if (role === "internal_employee")
    return "Registra pesagens na própria agência e consulta os registros permitidos para seu perfil.";

  if (role === "partner_admin")
    return "Administra colaboradores do próprio parceiro. Consultas operacionais dependem da habilitação do parceiro.";

  return "Acesso ao próprio parceiro, com consultas operacionais quando habilitadas.";
}
