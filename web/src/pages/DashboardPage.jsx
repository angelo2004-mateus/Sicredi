import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../hooks/use-session.jsx";
import { useOptions } from "../hooks/use-options.js";
import { api, queryString } from "../services/api.js";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback.jsx";
import { MetricCards, StatusBadge } from "../components/DataDisplay.jsx";
import {
  ChartCard,
  PeriodChart,
  BarChart,
} from "../components/DashboardCharts.jsx";
import { formatDate, formatWeight } from "../utils/format.js";
import { PageHeader } from "../components/PageHeader.jsx";

export function DashboardPage() {
  const { user } = useSession();
  const [days, setDays] = useState(0);
  const [residueId, setResidueId] = useState("");
  const enabled =
    user.permissions.general_dashboard || user.permissions.agency_dashboard;
  const filters = useMemo(
    () => ({
      ...(days
        ? { start_date: new Date(Date.now() - days * 86400000).toISOString() }
        : {}),
      residue_type_id: residueId,
      period: "day",
    }),
    [days, residueId],
  );
  const query = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => api(`/dashboard/summary${queryString(filters)}`),
    enabled,
  });
  const agencies = useOptions("agencies", enabled);
  const residues = useOptions("residue-types", enabled);
  const data = query.data;
  const agencyName = (id) =>
    agencies.data?.find((row) => row.id === id)?.name || "Agência";
  const residueName = (id) =>
    residues.data?.find((row) => row.id === id)?.name || "Resíduo";

  return (
    <>
      <header className="page-header dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Acompanhe peso, pesagens e resultados no período selecionado</p>
        </div>
        {enabled && (
          <div className="dashboard-filters">
            <select
              aria-label="Tipo de resíduo"
              value={residueId}
              onChange={(event) => setResidueId(event.target.value)}
            >
              <option value="">Todos os tipos</option>
              {residues.data?.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <div className="segmented-control" aria-label="Período">
              {[
                [90, "3 meses"],
                [30, "30 dias"],
                [7, "7 dias"],
                [0, "Tudo"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={days === value ? "active" : ""}
                  aria-pressed={days === value}
                  onClick={() => setDays(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      {!enabled && (
        <section className="panel">
          <PageHeader
            title={`Bem-vindo, ${user.name}`}
            description="Use o menu para acessar os recursos disponíveis para seu perfil."
          />
          {user.permissions.create_weighing && (
            <Link className="button" to="/pesagens/nova">
              Registrar uma pesagem
            </Link>
          )}
        </section>
      )}
      {enabled && query.isPending && <Loading />}
      <ErrorMessage
        error={query.error || agencies.error || residues.error}
        onRetry={() => {
          query.refetch();
          agencies.refetch();
          residues.refetch();
        }}
      />
      {data && (
        <>
          <MetricCards
            className="dashboard-metrics"
            items={[
              {
                label: "Peso registrado",
                value: formatWeight(data.total_weight_kg),
                description: `${days ? `Últimos ${days} dias` : "Histórico completo"} · Soma das pesagens incluídas nos indicadores`,
              },
              {
                label: "Pesagens no período",
                value: data.weighing_count,
                description: "Quantidade de sacos registrados no escopo",
              },
              {
                label: "Média por saco",
                value: formatWeight(data.average_weight_kg),
                description: "Peso médio das pesagens no período",
              },
            ]}
          />
          <ChartCard
            title="Movimentação no período"
            description="Peso total registrado em kg · períodos em UTC"
          >
            <PeriodChart rows={data.by_period} />
          </ChartCard>
          <div className="chart-grid">
            <ChartCard
              title="Peso por tipo de resíduo"
              description="Distribuição no período selecionado"
            >
              <BarChart
                rows={data.by_residue_type}
                labelFor={(row) => residueName(row.residue_type_id)}
              />
            </ChartCard>
            <ChartCard
              title="Top agências"
              description="Maiores volumes de origem no período"
            >
              <BarChart
                rows={data.by_agency}
                labelFor={(row) => agencyName(row.agency_id)}
              />
            </ChartCard>
          </div>
          <section className="panel table-panel">
            <div className="chart-heading">
              <h2>Últimas pesagens</h2>
              <p>Consulte os lançamentos e abra o detalhe de cada pesagem</p>
            </div>
            {!data.latest.length ? (
              <EmptyState />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Data e hora</th>
                      <th>Agência</th>
                      <th>Resíduo</th>
                      <th>Status</th>
                      <th>Peso</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.latest.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.weighed_at)}</td>
                        <td>{agencyName(row.agency_id)}</td>
                        <td>{residueName(row.residue_type_id)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>{formatWeight(row.weight_kg)}</td>
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
            <div className="chart-heading">
              <Link className="button secondary" to="/pesagens">
                Ver todas as pesagens
              </Link>
            </div>
          </section>
          <p
            className="nav-label muted"
            style={{ color: "var(--muted-foreground)", textAlign: "center" }}
          >
            Cadastros no escopo · ativos
          </p>
          <div className="platform-counts">
            {[
              ["agencies", "agências"],
              ["users", "usuários"],
              ["partners", "parceiros"],
            ].map(([key, label]) => (
              <span key={key}>
                <strong>{data.counts[key]}</strong>
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}
