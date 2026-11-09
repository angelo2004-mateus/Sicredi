import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../hooks/use-session.jsx";
import { api } from "../services/api.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage, EmptyState } from "../components/Feedback.jsx";
import { formatWeight } from "../utils/format.js";

export function DashboardPage() {
  const { user } = useSession();
  const enabled =
    user.permissions.general_dashboard || user.permissions.agency_dashboard;
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard/summary"),
    enabled,
  });

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Acompanhe os registros de resíduos do seu escopo."
      />
      {!enabled && (
        <section className="panel">
          <h2>Bem-vindo, {user.name}</h2>
          <p>
            Use o menu para acessar os recursos disponíveis para seu perfil.
          </p>
          {user.permissions.create_weighing && (
            <Link to="/pesagens/nova">Registrar uma pesagem</Link>
          )}
        </section>
      )}
      {enabled && query.isPending && <Loading />}
      <ErrorMessage error={query.error} onRetry={query.refetch} />
      {query.data && (
        <>
          <div className="metrics">
            <section className="panel">
              <span>Peso total</span>
              <strong>{formatWeight(query.data.total_weight_kg)}</strong>
            </section>
            <section className="panel">
              <span>Pesagens</span>
              <strong>{query.data.weighing_count}</strong>
            </section>
            <section className="panel">
              <span>Média por saco</span>
              <strong>{formatWeight(query.data.average_weight_kg)}</strong>
            </section>
          </div>
          <section className="panel">
            <h2>Últimos lançamentos</h2>
            {!query.data.latest.length ? (
              <EmptyState />
            ) : (
              <ul className="record-list">
                {query.data.latest.map((row) => (
                  <li key={row.id}>
                    <Link to={`/pesagens/${row.id}`}>
                      {formatWeight(row.weight_kg)}
                    </Link>
                    <span>
                      {new Date(row.weighed_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
