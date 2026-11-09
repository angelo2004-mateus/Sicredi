import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ResourceEditor } from "../components/resources/ResourceForm.jsx";
import {
  resourceDefinitions,
  canEditResource,
} from "../services/resource-definitions.js";
import { api, queryString } from "../services/api.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback.jsx";
import {
  MetricCards,
  Pagination,
  StatusBadge,
} from "../components/DataDisplay.jsx";
import { Icon } from "../components/Icon.jsx";
import { PermissionGate } from "../layouts/AppLayout.jsx";
import { useSession } from "../hooks/use-session.jsx";
import { roleLabels } from "../utils/format.js";

const presentation = {
  agencies: {
    description: "Cadastre e mantenha as sedes da operação Sicredi",
    create: "Nova agência",
    icon: "building",
    active: "Agências ativas",
    placeholder: "Nome, código, cidade, CNPJ ou responsável…",
  },
  users: {
    description: "Cadastre e gerencie o acesso dos colaboradores",
    create: "Novo usuário",
    icon: "users",
    active: "Usuários ativos",
    placeholder: "Nome ou e-mail…",
  },
  partners: {
    description: "Conecte os parceiros da cadeia de destinação",
    create: "Novo parceiro",
    icon: "handshake",
    active: "Parceiros ativos",
    placeholder: "Nome, CNPJ ou cidade…",
  },
  "residue-types": {
    description: "Defina cores e orientações para a separação dos resíduos",
    create: "Novo tipo",
    icon: "recycle",
    active: "Tipos ativos",
    placeholder: "Nome, descrição ou destinação…",
  },
  "partner-types": {
    description: "Classifique os parceiros por papel na cadeia de destinação",
    create: "Novo tipo",
    icon: "tags",
    active: "Tipos ativos",
    placeholder: "Nome ou descrição…",
  },
};

async function fetchRecords(resource) {
  const rows = [];
  let page = 1;
  let total = Infinity;

  while (rows.length < total) {
    const response = await api(
      `/${resource}${queryString({ page, page_size: 100 })}`,
    );
    rows.push(...response.data);
    total = response.pagination.total;
    page += 1;
    if (!response.data.length) break;
  }

  return rows;
}

export function ResourcesPage({ resource, title, access = "internal" }) {
  const { user } = useSession();
  const allowed =
    access === "all"
      ? user.permissions.read_partners
      : access === "users"
        ? user.permissions.manage_users
        : !user.partner_id;

  return (
    <PermissionGate allowed={allowed}>
      <ResourceList key={resource} resource={resource} title={title} />
    </PermissionGate>
  );
}

function ResourceList({ resource, title }) {
  const { user } = useSession();
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const permissions = user.permissions.resources?.[resource] || {};
  const view = presentation[resource];
  const definition = resourceDefinitions[resource];
  const cards = resource.endsWith("-types");
  const query = useQuery({
    queryKey: ["resources", resource],
    queryFn: () => fetchRecords(resource),
  });
  const rows = query.data || [];
  const filtered = rows
    .filter(
      (row) =>
        (!status || row.status === status) &&
        (!role || row.role === role) &&
        (!state || row.state === state) &&
        [
          row.name,
          row.code,
          row.email,
          row.city,
          row.cnpj,
          row.technical_responsible,
          row.description,
          row.default_destination,
        ].some((value) =>
          String(value || "")
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
        ),
    )
    .sort(
      (a, b) =>
        (sort === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "pt-BR"),
    );
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const active = rows.filter((row) => row.status === "active").length;
  const states = [
    ...new Set(rows.map((row) => row.state).filter(Boolean)),
  ].sort();
  const stats = [
    {
      label: cards
        ? "Tipos cadastrados"
        : resource === "users"
          ? "Total no escopo"
          : "Total cadastrado",
      value: rows.length,
      icon: view.icon,
    },
    { label: view.active, value: active, icon: "check" },
    {
      label: resource === "users" ? "Internos / parceiros" : "Inativos",
      value:
        resource === "users"
          ? `${rows.filter((row) => !row.partner_id).length} / ${rows.filter((row) => row.partner_id).length}`
          : rows.length - active,
      icon: resource === "users" ? "building" : "clipboard",
    },
  ];

  function openEditor(row) {
    setNotice("");
    setEditor(row);
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function editAction(row, card = false) {
    if (!permissions.update) return null;
    if (!canEditResource(user, resource, row))
      return resource === "users" && row.id === user.id ? (
        <Link to="/perfil" className="muted">
          Meu perfil
        </Link>
      ) : (
        "—"
      );

    return (
      <button
        type="button"
        className={card ? "secondary" : "icon-button"}
        onClick={() => openEditor(row)}
        aria-label={`Editar ${row.name}`}
        title={`Editar ${definition.singular}`}
      >
        <Icon name="pencil" />
        {card && "Editar"}
      </button>
    );
  }

  return (
    <>
      <PageHeader title={title} description={view.description}>
        {permissions.create && (
          <button type="button" onClick={() => openEditor({ id: null })}>
            <Icon name="plus" />
            {view.create}
          </button>
        )}
      </PageHeader>
      {notice && (
        <p role="status" className="feedback feedback-success">
          {notice}
        </p>
      )}
      {editor && (
        <ResourceEditor
          key={`${resource}-${editor.id || "new"}`}
          resource={resource}
          record={editor}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null);
            setNotice(message);
          }}
        />
      )}
      <ErrorMessage error={query.error} onRetry={query.refetch} />
      {query.isPending ? (
        <Loading />
      ) : (
        query.data && (
          <>
            <MetricCards items={stats} />
            <div className="panel filters resource-filters">
              <label className="search-field">
                Buscar
                <span className="search-input">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      changeFilter(setSearch, event.target.value)
                    }
                    placeholder={view.placeholder}
                    maxLength={100}
                  />
                </span>
              </label>
              {resource === "users" && (
                <label>
                  Perfil
                  <select
                    value={role}
                    onChange={(event) =>
                      changeFilter(setRole, event.target.value)
                    }
                  >
                    <option value="">Todos os perfis</option>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) =>
                    changeFilter(setStatus, event.target.value)
                  }
                >
                  <option value="">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </label>
              {resource === "agencies" && (
                <label>
                  UF
                  <select
                    value={state}
                    onChange={(event) =>
                      changeFilter(setState, event.target.value)
                    }
                  >
                    <option value="">Todas</option>
                    {states.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}
              {cards && (
                <label>
                  Ordenar
                  <select
                    value={sort}
                    onChange={(event) =>
                      changeFilter(setSort, event.target.value)
                    }
                  >
                    <option value="asc">Nome A–Z</option>
                    <option value="desc">Nome Z–A</option>
                  </select>
                </label>
              )}
            </div>
            {!filtered.length ? (
              <section className="panel">
                <EmptyState />
              </section>
            ) : cards ? (
              <div className="type-grid">
                {visible.map((row) => (
                  <section
                    className="type-card"
                    key={row.id}
                    style={{ "--type-color": row.color || "var(--primary)" }}
                  >
                    <div className="type-card-header">
                      <div className="type-icon">
                        <Icon
                          name={
                            resource === "residue-types"
                              ? "recycle"
                              : "briefcase"
                          }
                          size={20}
                        />
                      </div>
                      <div>
                        <h2>{row.name}</h2>
                        {row.default_destination && (
                          <small>{row.default_destination}</small>
                        )}
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="type-description">
                      {row.description || "Sem descrição informada."}
                    </p>
                    <div className="type-card-actions">
                      {editAction(row, true)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <section className="panel table-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {resource === "agencies" && <th>Código</th>}
                        <th>
                          {resource === "users"
                            ? "Usuário"
                            : resource === "agencies"
                              ? "Agência"
                              : "Parceiro"}
                        </th>
                        {resource === "users" ? (
                          <>
                            <th>Perfil</th>
                            <th>Vínculo</th>
                          </>
                        ) : (
                          <>
                            <th>Localização</th>
                            <th>
                              {resource === "agencies"
                                ? "Responsável"
                                : "Contato"}
                            </th>
                          </>
                        )}
                        <th>Status</th>
                        {permissions.update && <th>Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.id}>
                          {resource === "agencies" && (
                            <td>
                              <small>{row.code}</small>
                            </td>
                          )}
                          <td>
                            <strong>{row.name}</strong>
                            <small>
                              {resource === "users"
                                ? row.email
                                : row.cnpj || row.trade_name}
                            </small>
                          </td>
                          {resource === "users" ? (
                            <>
                              <td>{roleLabels[row.role]}</td>
                              <td>
                                {row.role === "super_admin"
                                  ? "Organização"
                                  : row.agency_id
                                    ? "Agência vinculada"
                                    : "Parceiro vinculado"}
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                {row.city
                                  ? `${row.city}${row.state ? `/${row.state}` : ""}`
                                  : "—"}
                                <small>{row.region}</small>
                              </td>
                              <td>
                                {resource === "agencies"
                                  ? row.technical_responsible || "—"
                                  : row.email || row.phone || "—"}
                              </td>
                            </>
                          )}
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          {permissions.update && <td>{editAction(row)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(value) => changeFilter(setPageSize, value)}
            />
          </>
        )
      )}
    </>
  );
}
