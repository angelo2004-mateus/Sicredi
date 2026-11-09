import { Link } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { StatusBadge } from "../components/DataDisplay.jsx";
import { roleScopeDescription } from "../services/resource-definitions.js";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../hooks/use-session.jsx";
import { api } from "../services/api.js";
import { PageHeader } from "../components/PageHeader.jsx";
import { ErrorMessage } from "../components/Feedback.jsx";
import { roleLabels } from "../utils/format.js";

export function ProfilePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (name) => api("/me", { method: "PATCH", body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      setSaved(true);
    },
  });

  function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    mutation.mutate(
      String(new FormData(event.currentTarget).get("name")).trim(),
    );
  }

  return (
    <>
      <PageHeader
        title="Meu perfil"
        description="Dados do seu cadastro neste sistema"
      >
        <Link className="button secondary" to="/">
          <Icon name="arrow-left" />
          Voltar
        </Link>
      </PageHeader>
      <ErrorMessage error={mutation.error} />
      {saved && <p role="status">Nome atualizado.</p>}
      <section className="panel profile-card">
        <div className="profile-banner">
          <span className="avatar">
            {user.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <div className="profile-badges">
              <span className="role-badge">
                <Icon name="shield" size={12} />
                &nbsp; {roleLabels[user.role]}
              </span>
              <StatusBadge status="active" />
            </div>
          </div>
        </div>
        <section className="profile-section">
          <h3>Dados pessoais</h3>
          <p>Informações usadas para identificação e contato</p>
          <dl className="profile-details">
            <div>
              <dt>Nome completo</dt>
              <dd>
                <Icon name="user" />
                {user.name}
              </dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>
                <Icon name="mail" />
                {user.email}
              </dd>
            </div>
          </dl>
        </section>
        <section className="profile-section">
          <h3>Vínculo operacional</h3>
          <p>Onde você atua dentro da operação Lixo Zero</p>
          <dl className="profile-details">
            <div>
              <dt>Perfil de acesso</dt>
              <dd>{roleLabels[user.role]}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Ativo</dd>
            </div>
          </dl>
          <p style={{ marginTop: 24, marginBottom: 0 }}>
            {roleScopeDescription(user.role)}
          </p>
        </section>
        <section className="profile-section">
          <h3>Atualizar cadastro</h3>
          <p>Edite seu nome de exibição</p>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Nome completo
              <input
                name="name"
                required
                maxLength={255}
                defaultValue={user.name}
              />
            </label>
            <div>
              <button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Salvando…" : "Salvar nome"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </>
  );
}
