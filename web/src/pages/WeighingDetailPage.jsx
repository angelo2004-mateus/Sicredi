import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api.js";
import { useSession } from "../hooks/use-session.jsx";
import { PermissionGate } from "../layouts/AppLayout.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage } from "../components/Feedback.jsx";
import { formatDate, formatWeight, statusLabels } from "../utils/format.js";

export function WeighingDetailPage() {
  const { user } = useSession();

  return (
    <PermissionGate
      allowed={!user.partner_id || user.permissions.read_partner_weighings}
    >
      <WeighingDetail />
    </PermissionGate>
  );
}

function WeighingDetail() {
  const { user } = useSession();
  const { id } = useParams();
  const query = useQuery({
    queryKey: ["weighing", id],
    queryFn: () => api(`/weighings/${encodeURIComponent(id)}`),
  });

  const canReadReferences = Boolean(query.data) && !user.partner_id;

  const agency = useQuery({
    queryKey: ["agency", query.data?.agency_id],
    queryFn: () => api(`/agencies/${query.data.agency_id}`),
    enabled: canReadReferences,
  });

  const residue = useQuery({
    queryKey: ["residue-type", query.data?.residue_type_id],
    queryFn: () => api(`/residue-types/${query.data.residue_type_id}`),
    enabled: canReadReferences,
  });

  return (
    <>
      <PageHeader title="Detalhe da pesagem">
        <Link to="/pesagens">Voltar ao histórico</Link>
      </PageHeader>
      {query.isPending && <Loading />}
      <ErrorMessage error={query.error} onRetry={query.refetch} />
      {query.data && (
        <section className="panel">
          <dl className="details">
            <dt>Peso</dt>
            <dd>{formatWeight(query.data.weight_kg)}</dd>
            <dt>Data e hora</dt>
            <dd>{formatDate(query.data.weighed_at)}</dd>
            <dt>Status</dt>
            <dd>{statusLabels[query.data.status]}</dd>
            <dt>Agência</dt>
            <dd>
              {agency.data?.name ||
                (canReadReferences && agency.isPending
                  ? "Carregando…"
                  : "Não disponível")}
            </dd>
            <dt>Tipo de resíduo</dt>
            <dd>
              {residue.data?.name ||
                (canReadReferences && residue.isPending
                  ? "Carregando…"
                  : "Não disponível")}
            </dd>
            <dt>Observações</dt>
            <dd>{query.data.notes || "Não informadas"}</dd>
          </dl>
        </section>
      )}
    </>
  );
}
