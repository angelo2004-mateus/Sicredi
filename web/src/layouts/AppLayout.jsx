import { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useSession } from "../hooks/use-session.jsx";
import { Loading, ErrorMessage } from "../components/Feedback.jsx";
import { roleLabels } from "../utils/format.js";

export function AppLayout() {
  const { user, loading, error, retry, logout } = useSession();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <Loading message="Verificando sessão…" />;

  if (error) return <ErrorMessage error={error} onRetry={retry} />;

  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const internal = !user.partner_id;
  const canReadWeighings = internal || user.permissions.read_partner_weighings;
  const links = [
    ["/", "Início", true],
    ["/pesagens/nova", "Registrar pesagem", user.permissions.create_weighing],
    ["/pesagens", "Histórico", canReadWeighings],
    ["/agencias", "Agências", internal],
    ["/usuarios", "Usuários", user.permissions.manage_users],
    ["/parceiros", "Parceiros", user.permissions.read_partners],
    ["/tipos-parceiros", "Tipos de parceiros", internal],
    ["/residuos", "Tipos de resíduos", internal],
    ["/relatorios", "Relatórios", canReadWeighings],
    ["/perfil", "Meu perfil", true],
  ];

  async function handleLogout() {
    setSigningOut(true);
    setLogoutError(null);

    try {
      await logout();
    } catch (failure) {
      setLogoutError(failure);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <strong className="brand">Lixo Zero</strong>
        <span className="muted">Sicredi Ouro Verde MT/PA</span>
        <nav aria-label="Navegação principal">
          {links
            .filter(([, , visible]) => visible)
            .map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/" || to === "/pesagens"}>
                {label}
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div>
            <strong>{user.name}</strong>
            <span className="muted">{roleLabels[user.role]}</span>
          </div>
          <button type="button" onClick={handleLogout} disabled={signingOut}>
            {signingOut ? "Saindo…" : "Sair"}
          </button>
        </header>
        <main id="conteudo">
          <ErrorMessage error={logoutError} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PermissionGate({ allowed, children }) {
  return allowed ? (
    children
  ) : (
    <section className="panel">
      <h1>Acesso indisponível</h1>
      <p>Este recurso não está habilitado para seu perfil.</p>
    </section>
  );
}
