import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/use-session.jsx";
import { useOptions } from "../hooks/use-options.js";
import { api } from "../services/api.js";
import { PermissionGate } from "../layouts/AppLayout.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { Loading, ErrorMessage } from "../components/Feedback.jsx";

export function NewWeighingPage() {
  const { user } = useSession();

  return (
    <PermissionGate allowed={user.permissions.create_weighing}>
      <WeighingForm />
    </PermissionGate>
  );
}

function WeighingForm() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState(null);
  const isSuper = user.role === "super_admin";
  const residues = useOptions("residue-types");
  const agencies = useOptions("agencies", isSuper);
  const partners = useOptions("partners");
  const mutation = useMutation({
    mutationFn: (body) => api("/weighings", { method: "POST", body }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["weighings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      navigate(`/pesagens/${row.id}`, { replace: true });
    },
  });

  const loading =
    residues.isPending || partners.isPending || (isSuper && agencies.isPending);
  const optionsError = residues.error || partners.error || agencies.error;

  function handleSubmit(event) {
    event.preventDefault();
    setValidationError(null);

    const values = new FormData(event.currentTarget);
    const weight = String(values.get("weight_kg")).trim().replace(",", ".");

    if (!/^\d{1,7}(\.\d{1,3})?$/.test(weight) || Number(weight) <= 0) {
      setValidationError(
        new Error(
          "Informe um peso maior que zero, com até três casas decimais.",
        ),
      );
      return;
    }

    const body = {
      residue_type_id: values.get("residue_type_id"),
      weight_kg: weight,
    };

    if (isSuper) body.agency_id = values.get("agency_id");
    if (values.get("destination_partner_id"))
      body.destination_partner_id = values.get("destination_partner_id");
    if (String(values.get("notes")).trim())
      body.notes = String(values.get("notes")).trim();

    mutation.mutate(body);
  }

  return (
    <>
      <PageHeader
        title="Registrar pesagem"
        description="Cada lançamento corresponde ao peso de um saco de resíduo."
      />
      {loading && <Loading />}
      <ErrorMessage
        error={optionsError}
        onRetry={() => {
          residues.refetch();
          partners.refetch();
          if (isSuper) agencies.refetch();
        }}
      />
      <ErrorMessage error={validationError || mutation.error} />
      {!loading && !optionsError && (
        <form className="panel form-stack narrow" onSubmit={handleSubmit}>
          <label>
            Tipo de resíduo
            <select name="residue_type_id" required defaultValue="">
              <option value="" disabled>
                Selecione um tipo
              </option>
              {residues.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Peso do saco (kg)
            <input
              name="weight_kg"
              inputMode="decimal"
              required
              placeholder="Ex.: 8,750"
              maxLength={11}
            />
          </label>
          {isSuper && (
            <label>
              Agência
              <select name="agency_id" required defaultValue="">
                <option value="" disabled>
                  Selecione uma agência
                </option>
                {agencies.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Parceiro de destinação (opcional)
            <select name="destination_partner_id" defaultValue="">
              <option value="">Não informado</option>
              {partners.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observações (opcional)
            <textarea name="notes" rows={3} maxLength={5000} />
          </label>
          <p className="muted">
            A data, a hora e o responsável serão registrados automaticamente.
          </p>
          <button
            type="submit"
            disabled={
              mutation.isPending ||
              !residues.data.length ||
              (isSuper && !agencies.data.length)
            }
          >
            {mutation.isPending ? "Registrando…" : "Registrar pesagem"}
          </button>
        </form>
      )}
    </>
  );
}
