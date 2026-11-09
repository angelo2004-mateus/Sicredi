import { Link } from "react-router-dom";
import { ResourceEditor } from "../components/resources/ResourceForm.jsx";
import {
  resourceDefinitions,
  canEditResource,
} from "../services/resource-definitions.js";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, queryString } from "../services/api.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback.jsx";
import { PermissionGate } from "../layouts/AppLayout.jsx";
import { useSession } from "../hooks/use-session.jsx";
import { roleLabels, statusLabels } from "../utils/format.js";

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
  const permissions = user.permissions.resources?.[resource] || {};
  const definition = resourceDefinitions[resource];

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["resources", resource, search, page],
    queryFn: () =>
      api(`/${resource}${queryString({ search, page, page_size: 20 })}`),
  });

  function handleSearch(event) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get("search")).trim());
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title={title}
        description="Cadastros e ações disponíveis conforme seu perfil e unidade."
      >
        {permissions.create && (
          <button
            type="button"
            onClick={() => {
              setNotice("");
              setEditor({ id: null });
            }}
            disabled={Boolean(editor)}
          >
            Cadastrar {definition.singular}
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
      <form onSubmit={handleSearch} className="panel filters">
        <label>
          Buscar por nome
          <input name="search" type="search" maxLength={100} />
        </label>
        <button type="submit">Buscar</button>
      </form>
      <ErrorMessage error={query.error} onRetry={query.refetch} />
      {query.isPending && <Loading />}
      {query.data && (
        <section className="panel">
          {!query.data.data.length ? (
            <EmptyState />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    {resource === "users" && (
                      <>
                        <th>E-mail</th>
                        <th>Perfil</th>
                      </>
                    )}
                    <th>Status</th>
                    {permissions.update && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      {resource === "users" && (
                        <>
                          <td>{row.email}</td>
                          <td>{roleLabels[row.role]}</td>
                        </>
                      )}
                      <td>{statusLabels[row.status]}</td>
                      {permissions.update && (
                        <td>
                          {canEditResource(user, resource, row) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setNotice("");
                                setEditor(row);
                              }}
                              disabled={Boolean(editor)}
                              aria-label={`Editar ${row.name}`}
                            >
                              Editar
                            </button>
                          ) : resource === "users" && row.id === user.id ? (
                            <Link to="/perfil">Meu perfil</Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination">
            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Anterior
            </button>
            <span>
              Página {page} · {query.data.pagination.total} registros
            </span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page * 20 >= query.data.pagination.total}
            >
              Próxima
            </button>
          </div>
        </section>
      )}
    </>
  );
}
