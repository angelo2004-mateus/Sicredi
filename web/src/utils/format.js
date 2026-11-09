export const roleLabels = {
  super_admin: "Super Admin",
  agency_admin: "Admin da agência",
  internal_employee: "Colaborador interno",
  partner_admin: "Admin do parceiro",
  partner_employee: "Colaborador do parceiro",
};

export const statusLabels = {
  active: "Ativo",
  inactive: "Inativo",
  corrected: "Corrigido",
  cancelled: "Cancelado",
};

export function formatWeight(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(number)} kg`
    : "—";
}

export function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
