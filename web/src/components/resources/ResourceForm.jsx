import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api.js";
import { useSession } from "../../hooks/use-session.jsx";
import { useOptions } from "../../hooks/use-options.js";
import {
  resourceDefinitions,
  roleScopeDescription,
} from "../../services/resource-definitions.js";
import { roleLabels } from "../../utils/format.js";
import { Loading, ErrorMessage } from "../Feedback.jsx";

export function ResourceEditor({ resource, record, onClose, onSaved }) {
  const detail = useQuery({
    queryKey: ["resource-detail", resource, record?.id],
    queryFn: () => api(`/${resource}/${record.id}`),
    enabled: Boolean(record?.id),
  });

  if (record?.id && detail.isPending)
    return <Loading message="Carregando cadastro…" />;

  if (record?.id && detail.error) {
    return (
      <section className="panel">
        <ErrorMessage error={detail.error} onRetry={detail.refetch} />
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </section>
    );
  }

  return (
    <ResourceForm
      resource={resource}
      initial={record?.id ? detail.data : null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ResourceForm({ resource, initial, onClose, onSaved }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const definition = resourceDefinitions[resource];
  const editing = Boolean(initial);
  const central = user.role === "super_admin";

  const allowedRoles = user.permissions.assignable_user_roles || [];
  const defaultRole = allowedRoles.includes("internal_employee")
    ? "internal_employee"
    : allowedRoles[0];

  const [role, setRole] = useState(initial?.role || defaultRole);
  const [localError, setLocalError] = useState(null);
  const [agencyIds, setAgencyIds] = useState(
    initial?.agency_links
      ?.filter((link) => link.status === "active")
      .map((link) => link.agency_id) || [],
  );
  const [typeIds, setTypeIds] = useState(
    initial?.type_links?.map((link) => link.partner_type_id) || [],
  );

  const needsAgencies =
    central && (resource === "users" || resource === "partners");
  const needsPartners = central && resource === "users";
  const needsTypes = central && resource === "partners";
  const agencies = useOptions(
    "agencies",
    needsAgencies,
    resource === "partners" && editing,
  );
  const partners = useOptions("partners", needsPartners);
  const types = useOptions("partner-types", needsTypes, editing);

  const loading =
    (needsAgencies && agencies.isPending) ||
    (needsPartners && partners.isPending) ||
    (needsTypes && types.isPending);
  const optionsError =
    (needsAgencies && agencies.error) ||
    (needsPartners && partners.error) ||
    (needsTypes && types.error);

  const mutation = useMutation({
    mutationFn: (body) =>
      api(`/${resource}${editing ? `/${initial.id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", resource] });
      queryClient.invalidateQueries({
        queryKey: ["resource-detail", resource],
      });
      queryClient.invalidateQueries({ queryKey: ["options"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["agency"] });
      queryClient.invalidateQueries({ queryKey: ["residue-type"] });

      onSaved(
        `${editing ? "Alterações salvas" : "Cadastro realizado"} com sucesso.`,
      );
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    setLocalError(null);

    const values = new FormData(event.currentTarget);
    const body = {};

    for (const field of definition.fields) {
      const value = String(values.get(field.name) || "").trim();
      body[field.name] = value || null;
    }

    body.status = values.get("status");

    if (resource === "users") {
      body.role = role;

      const password = String(values.get("password") || "");
      const cpf = String(values.get("cpf") || "").trim();

      if (password) body.password = password;
      if (cpf) body.cpf = cpf;

      if (!editing && !password) {
        setLocalError(new Error("Informe a senha inicial do usuário."));
        return;
      }

      if (central) {
        const internal = ["agency_admin", "internal_employee"].includes(role);
        const external = ["partner_admin", "partner_employee"].includes(role);

        body.agency_id = internal ? values.get("agency_id") : null;
        body.partner_id = external ? values.get("partner_id") : null;
      }
    }

    if (resource === "partners" && central) {
      body.agency_ids = agencyIds;
      body.partner_type_ids = typeIds;
    }

    mutation.mutate(body);
  }

  function toggleSelection(setter, id, checked) {
    setter((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }

  function retryOptions() {
    if (needsAgencies) agencies.refetch();
    if (needsPartners) partners.refetch();
    if (needsTypes) types.refetch();
  }

  return (
    <section className="panel" aria-labelledby="resource-form-title">
      <div className="page-header">
        <h2 id="resource-form-title">
          {editing ? "Editar" : "Cadastrar"} {definition.singular}
        </h2>
        <button type="button" onClick={onClose} disabled={mutation.isPending}>
          Fechar formulário
        </button>
      </div>
      {loading && <Loading />}
      <ErrorMessage error={optionsError} onRetry={retryOptions} />
      <ErrorMessage error={localError || mutation.error} />
      {!loading && !optionsError && (
        <form onSubmit={handleSubmit} className="form-stack">
          <fieldset disabled={mutation.isPending} className="form-fields">
            <div className="form-grid">
              {definition.fields.map((field, index) => (
                <label key={field.name}>
                  {field.label}
                  {field.required ? " *" : ""}
                  {field.type === "textarea" ? (
                    <textarea
                      name={field.name}
                      defaultValue={initial?.[field.name] || ""}
                      maxLength={field.maxLength}
                      rows={3}
                    />
                  ) : (
                    <input
                      name={field.name}
                      type={field.type || "text"}
                      defaultValue={initial?.[field.name] || ""}
                      required={field.required}
                      minLength={field.required ? 1 : undefined}
                      maxLength={field.maxLength || 255}
                      placeholder={field.placeholder}
                      pattern={field.pattern}
                      autoFocus={index === 0}
                    />
                  )}
                </label>
              ))}
            </div>
            {resource === "users" && (
              <>
                <div className="form-grid">
                  <label>
                    {editing ? "Nova senha (opcional)" : "Senha inicial *"}
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required={!editing}
                    />
                    <span className="muted">
                      Pelo menos 12 caracteres.
                      {editing && " Deixe em branco para manter a senha."}
                    </span>
                  </label>
                  <label>
                    {editing
                      ? "CPF (preencha para substituir)"
                      : "CPF (opcional)"}
                    <input name="cpf" inputMode="numeric" maxLength={14} />
                  </label>
                  <label>
                    Perfil de acesso *
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      disabled={allowedRoles.length === 1}
                      required
                    >
                      {allowedRoles.map((value) => (
                        <option key={value} value={value}>
                          {roleLabels[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {central &&
                    ["agency_admin", "internal_employee"].includes(role) && (
                      <label>
                        Agência vinculada *
                        <select
                          key={`agency-${role}`}
                          name="agency_id"
                          defaultValue={initial?.agency_id || ""}
                          required
                        >
                          <option value="" disabled>
                            Selecione a agência
                          </option>
                          {agencies.data.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  {central &&
                    ["partner_admin", "partner_employee"].includes(role) && (
                      <label>
                        Parceiro vinculado *
                        <select
                          key={`partner-${role}`}
                          name="partner_id"
                          defaultValue={initial?.partner_id || ""}
                          required
                        >
                          <option value="" disabled>
                            Selecione o parceiro
                          </option>
                          {partners.data.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                </div>
                <p className="muted">
                  {roleScopeDescription(role)}
                  {!central &&
                    " O vínculo será definido automaticamente conforme a sua sessão."}
                </p>
              </>
            )}
            {resource === "partners" && central && (
              <div className="form-grid">
                <fieldset>
                  <legend>Agências vinculadas</legend>
                  {!agencies.data.length && (
                    <p>Cadastre uma agência para vinculá-la ao parceiro.</p>
                  )}
                  {agencies.data.map((row) => (
                    <label className="checkbox-label" key={row.id}>
                      <input
                        type="checkbox"
                        checked={agencyIds.includes(row.id)}
                        disabled={
                          row.status !== "active" &&
                          !initial?.agency_links?.some(
                            (link) =>
                              link.agency_id === row.id &&
                              link.status === "active",
                          )
                        }
                        onChange={(event) =>
                          toggleSelection(
                            setAgencyIds,
                            row.id,
                            event.target.checked,
                          )
                        }
                      />
                      {row.name}
                      {row.status !== "active" ? " (inativa)" : ""}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Tipos do parceiro</legend>
                  {!types.data.length && (
                    <p>Cadastre um tipo de parceiro para classificá-lo.</p>
                  )}
                  {types.data.map((row) => (
                    <label className="checkbox-label" key={row.id}>
                      <input
                        type="checkbox"
                        checked={typeIds.includes(row.id)}
                        disabled={
                          row.status !== "active" &&
                          !initial?.type_links?.some(
                            (link) => link.partner_type_id === row.id,
                          )
                        }
                        onChange={(event) =>
                          toggleSelection(
                            setTypeIds,
                            row.id,
                            event.target.checked,
                          )
                        }
                      />
                      {row.name}
                      {row.status !== "active" ? " (inativo)" : ""}
                    </label>
                  ))}
                </fieldset>
              </div>
            )}
            {resource === "partners" && user.role === "agency_admin" && (
              <p className="muted">
                O parceiro será vinculado automaticamente à sua agência.
                Alterações posteriores do cadastro compartilhado são realizadas
                pela administração central.
              </p>
            )}
            <label className="narrow">
              Status
              <select name="status" defaultValue={initial?.status || "active"}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
          </fieldset>
          <div className="form-actions">
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando…"
                : editing
                  ? "Salvar alterações"
                  : "Concluir cadastro"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
