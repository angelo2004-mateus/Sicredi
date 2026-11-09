import { Modal } from "../Modal.jsx";
import { Icon } from "../Icon.jsx";
import { useEffect, useRef, useState } from "react";
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
  const icons = {
    agencies: "building",
    users: "user",
    partners: "briefcase",
    "partner-types": "tags",
    "residue-types": "recycle",
  };

  return (
    <Modal
      title={`${record?.id ? "Editar" : resource === "agencies" ? "Cadastrar nova" : "Cadastrar novo"} ${resourceDefinitions[resource].singular}`}
      description={
        resource.endsWith("-types")
          ? "Defina as informações deste tipo."
          : "Preencha as informações em três etapas rápidas."
      }
      icon={icons[resource]}
      onClose={onClose}
    >
      {record?.id && detail.isPending ? (
        <Loading message="Carregando cadastro…" />
      ) : record?.id && detail.error ? (
        <ErrorMessage error={detail.error} onRetry={detail.refetch} />
      ) : (
        <ResourceForm
          resource={resource}
          initial={record?.id ? detail.data : null}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
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

  const formRef = useRef(null);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState([]);
  const simple = resource.endsWith("-types");
  const stepCount = simple ? 2 : 3;
  const lastStep = stepCount - 1;
  const [color, setColor] = useState(initial?.color || "#3fa110");
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

  useEffect(() => {
    if (loading || optionsError) return;

    const frame = requestAnimationFrame(() => {
      formRef.current
        ?.querySelector(
          `[data-step="${step}"] input, [data-step="${step}"] textarea, [data-step="${step}"] select`,
        )
        ?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [step, loading, optionsError]);

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

    if (step < lastStep) {
      continueStep();
      return;
    }

    const invalid = [...formRef.current.elements].find(
      (element) => element.willValidate && !element.checkValidity(),
    );
    if (invalid) {
      const section = invalid.closest("[data-step]");
      if (section) setStep(Number(section.dataset.step));
      requestAnimationFrame(() => invalid.reportValidity());
      return;
    }

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

  const steps = simple
    ? [
        ["Identidade", "Nome, descrição e cor", "tags"],
        ["Regras e revisão", "Destinação e conferência", "clipboard"],
      ]
    : resource === "agencies"
      ? [
          ["Identificação", "Dados oficiais da agência", "building"],
          ["Localização", "Endereço da unidade", "location"],
          ["Contato e revisão", "Responsável e conferência", "clipboard"],
        ]
      : resource === "users"
        ? [
            ["Dados pessoais", "Identificação do colaborador", "user"],
            ["Acesso e vínculo", "Perfil, senha e unidade", "shield"],
            ["Revisão", "Confira antes de salvar", "check"],
          ]
        : [
            ["Identificação", "Dados do parceiro", "briefcase"],
            ["Localização e contato", "Endereço e comunicação", "location"],
            ["Vínculos e revisão", "Classificação e agências", "handshake"],
          ];

  function fieldStep(name) {
    if (simple) return name === "default_destination" ? 1 : 0;
    if (resource === "users") return 0;
    if (resource === "agencies")
      return ["address", "city", "state"].includes(name)
        ? 1
        : name === "technical_responsible"
          ? 2
          : 0;
    return ["name", "trade_name", "cnpj"].includes(name) ? 0 : 1;
  }

  function continueStep() {
    const current = formRef.current.querySelector(`[data-step="${step}"]`);
    const invalid = [...current.querySelectorAll("input,select,textarea")].find(
      (element) => !element.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return;
    }

    const values = new FormData(formRef.current);
    setReview(
      definition.fields.map((field) => [
        field.label,
        String(values.get(field.name) || "—"),
      ]),
    );
    setStep(step + 1);
  }

  function renderField(field) {
    if (field.name === "color") {
      const palette = [
        "#3fa110",
        "#165e37",
        "#503822",
        "#ffcc33",
        "#f56b22",
        "#e01852",
        "#40c8ee",
        "#4c5750",
      ];

      return (
        <fieldset key={field.name} className="color-field full-width">
          <legend>Cor de identificação</legend>
          <div className="color-palette">
            {palette.map((value) => (
              <button
                type="button"
                key={value}
                style={{ background: value }}
                aria-label={`Cor ${value}`}
                aria-pressed={color.toLowerCase() === value}
                onClick={() => setColor(value)}
              >
                {color.toLowerCase() === value && <Icon name="check" />}
              </button>
            ))}
          </div>
          <div className="color-custom">
            <input
              type="color"
              aria-label="Cor personalizada"
              value={/^#[a-fA-F0-9]{6}$/.test(color) ? color : "#3fa110"}
              onChange={(event) => setColor(event.target.value)}
            />
            <input
              name="color"
              aria-label="Cor hexadecimal"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              pattern={field.pattern}
              maxLength={7}
            />
            <span className="muted">Ou informe um hex específico</span>
          </div>
        </fieldset>
      );
    }

    return (
      <label
        key={field.name}
        className={field.name === "name" ? "full-width" : undefined}
      >
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
            placeholder={
              field.placeholder ||
              (field.name === "name"
                ? "Ex.: " +
                  (resource === "users"
                    ? "Ana Silva"
                    : resource === "agencies"
                      ? "Agência Centro"
                      : "Nome do cadastro")
                : undefined)
            }
            pattern={field.pattern}
          />
        )}
      </label>
    );
  }

  return (
    <>
      {loading && <Loading />}
      <ErrorMessage error={optionsError} onRetry={retryOptions} />
      <ErrorMessage error={localError || mutation.error} />
      {!loading && !optionsError && (
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="wizard-layout">
            {
              <aside className="wizard-sidebar" aria-label="Etapas do cadastro">
                <div>
                  {steps.map(([title, description, icon], index) => (
                    <button
                      type="button"
                      key={title}
                      className={`wizard-step ${step === index ? "active" : ""}`}
                      aria-current={step === index ? "step" : undefined}
                      disabled={index > step || mutation.isPending}
                      onClick={() => setStep(index)}
                    >
                      <span className="step-icon">
                        <Icon name={icon} size={14} />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="wizard-progress">
                  <strong>Progresso</strong>
                  <progress value={step + 1} max={stepCount} />
                  Etapa {step + 1} de {stepCount}
                </div>
              </aside>
            }
            <div className="wizard-content">
              {
                <>
                  <span className="step-eyebrow">ETAPA {step + 1}</span>
                  <h2>{steps[step][0]}</h2>
                  <p>
                    {step === lastStep
                      ? "Confira as informações antes de concluir o cadastro."
                      : step === 0
                        ? "Comece pelos dados que identificam este cadastro na operação."
                        : "Complete os dados de vínculo, localização ou acesso."}
                  </p>
                </>
              }
              <fieldset disabled={mutation.isPending} className="form-fields">
                {Array.from({ length: stepCount }, (_, index) => index).map(
                  (index) => (
                    <div
                      className="wizard-fields form-stack"
                      data-step={index}
                      hidden={step !== index}
                      key={index}
                    >
                      <div className="form-grid">
                        {definition.fields
                          .filter((field) => fieldStep(field.name) === index)
                          .sort((a, b) =>
                            a.name === "name" ? -1 : b.name === "name" ? 1 : 0,
                          )
                          .map(renderField)}
                      </div>
                      {resource === "users" && index === 0 && (
                        <label>
                          {editing
                            ? "CPF (preencha para substituir)"
                            : "CPF (opcional)"}
                          <input
                            name="cpf"
                            inputMode="numeric"
                            maxLength={14}
                            placeholder="000.000.000-00"
                          />
                        </label>
                      )}
                      {resource === "users" && index === 1 && (
                        <>
                          <div className="form-grid">
                            <label>
                              {editing
                                ? "Nova senha (opcional)"
                                : "Senha inicial *"}
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
                                {editing &&
                                  " Deixe em branco para manter a senha."}
                              </span>
                            </label>
                            <label>
                              Perfil de acesso *
                              <select
                                value={role}
                                onChange={(event) =>
                                  setRole(event.target.value)
                                }
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
                              ["agency_admin", "internal_employee"].includes(
                                role,
                              ) && (
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
                              ["partner_admin", "partner_employee"].includes(
                                role,
                              ) && (
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
                      {resource === "partners" && index === 2 && central && (
                        <div className="form-grid">
                          <fieldset>
                            <legend>Agências vinculadas</legend>
                            {!agencies.data.length && (
                              <p>
                                Cadastre uma agência para vinculá-la ao
                                parceiro.
                              </p>
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
                              <p>
                                Cadastre um tipo de parceiro para classificá-lo.
                              </p>
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
                      {resource === "partners" && index === 2 && !central && (
                        <p className="muted">
                          O parceiro será vinculado automaticamente à sua
                          agência. Alterações posteriores do cadastro
                          compartilhado são realizadas pela administração
                          central.
                        </p>
                      )}
                      {index ===
                        (resource === "agencies"
                          ? 0
                          : resource === "users"
                            ? 1
                            : lastStep) && (
                        <label>
                          Situação
                          <select
                            name="status"
                            defaultValue={initial?.status || "active"}
                          >
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                          </select>
                        </label>
                      )}
                      {index === lastStep && (
                        <dl className="review-grid">
                          {review.map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                          {resource === "users" && (
                            <div>
                              <dt>Perfil de acesso</dt>
                              <dd>{roleLabels[role]}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  ),
                )}
              </fieldset>
            </div>
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="ghost"
              onClick={step > 0 ? () => setStep(step - 1) : onClose}
              disabled={mutation.isPending}
            >
              {step > 0 ? "Voltar" : "Cancelar"}
            </button>
            <button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando…"
                : step < lastStep
                  ? "Continuar"
                  : editing
                    ? "Salvar alterações"
                    : "Concluir cadastro"}
              {step < lastStep && <Icon name="chevron-right" />}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
