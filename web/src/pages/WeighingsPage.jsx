import { Icon } from "../components/Icon.jsx";
import { Pagination, StatusBadge } from "../components/DataDisplay.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../hooks/use-session.jsx";
import { api, ApiError, queryString } from "../services/api.js";
import { PermissionGate } from "../layouts/AppLayout.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback.jsx";
import { formatDate, formatWeight } from "../utils/format.js";

function dateFilters(start, end) {
  const result = {};

  if (start) result.start_date = new Date(`${start}T00:00:00`).toISOString();

  if (end) {
    const exclusive = new Date(`${end}T00:00:00`);
    exclusive.setDate(exclusive.getDate() + 1);
    result.end_date = exclusive.toISOString();
  }

  return result;
}

export function WeighingsPage({ report = false }) {
  const { user } = useSession();
  const allowed = !user.partner_id || user.permissions.read_partner_weighings;

  return (
    <PermissionGate allowed={allowed}>
      <WeighingsList report={report} />
    </PermissionGate>
  );
}

function WeighingsList({ report }) {
  const { user } = useSession();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const endpoint = report ? "/reports/weighings" : "/weighings";
  const query = useQuery({
    queryKey: [report ? "reports" : "weighings", filters, page],
    queryFn: () =>
      api(`${endpoint}${queryString({ ...filters, page, page_size: 10 })}`),
  });

  function applyFilters(event) {
    event.preventDefault();

    const values = new FormData(event.currentTarget);
    setFilters({
      ...dateFilters(values.get("start"), values.get("end")),
      status: values.get("status"),
    });
    setPage(1);
  }

  async function downloadCsv() {
    setExporting(true);
    setExportError(null);

    try {
      const response = await fetch(
        `/api/v1/reports/weighings${queryString({ ...filters, format: "csv" })}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        if (response.status === 401)
          window.dispatchEvent(new Event("session-expired"));
        throw new ApiError(
          response.status,
          await response.json().catch(() => null),
        );
      }

      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "pesagens.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setExportError(failure);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={report ? "Relatórios" : "Histórico de pesagens"}
        description="Consulte os registros disponíveis no seu escopo."
      >
        {report ? (
          <button type="button" onClick={downloadCsv} disabled={exporting}>
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>
        ) : (
          user.permissions.create_weighing && (
            <Link className="button" to="/pesagens/nova">
              <Icon name="plus" />
              Registrar pesagem
            </Link>
          )
        )}
      </PageHeader>
      <form className="panel filters" onSubmit={applyFilters}>
        <label>
          Data inicial
          <input type="date" name="start" />
        </label>
        <label>
          Data final
          <input type="date" name="end" />
        </label>
        <label>
          Status
          <select name="status" defaultValue="">
            <option value="">
              {report ? "Padrão dos indicadores" : "Todos"}
            </option>
            <option value="active">Ativo</option>
            <option value="corrected">Corrigido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>
      <ErrorMessage
        error={query.error || exportError}
        onRetry={query.error ? query.refetch : undefined}
      />
      {query.isPending && <Loading />}
      {query.data && (
        <section className="panel table-panel">
          {query.data.totals && (
            <p>
              <strong>
                Total do período:{" "}
                {formatWeight(query.data.totals.total_weight_kg)}
              </strong>{" "}
              · {query.data.totals.weighing_count} pesagens
            </p>
          )}
          {!query.data.data.length ? (
            <EmptyState />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data e hora</th>
                    <th>Peso</th>
                    <th>Status</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.weighed_at)}</td>
                      <td>{formatWeight(row.weight_kg)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>
                        <Link
                          className="button secondary"
                          to={`/pesagens/${row.id}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "0 16px 16px" }}>
            <Pagination
              page={page}
              pageSize={10}
              total={query.data.pagination.total}
              onPageChange={setPage}
            />
          </div>
        </section>
      )}
    </>
  );
}
