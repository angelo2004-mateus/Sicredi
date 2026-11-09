import { Icon } from "../components/Icon.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useSession } from "../hooks/use-session.jsx";
import { Loading, ErrorMessage } from "../components/Feedback.jsx";
import { roleLabels } from "../utils/format.js";

export function AppLayout() {
  const { user, loading, error, retry, logout } = useSession();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <Loading message="Verificando sessão…" />;

  if (error) return <ErrorMessage error={error} onRetry={retry} />;

  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const internal = !user.partner_id;
  const canReadWeighings = internal || user.permissions.read_partner_weighings;
  const groups = [
    { label: "Visão", links: [["/", "Dashboard", true, "dashboard"]] },
    {
      label: "Cadastros",
      links: [
        ["/agencias", "Agências", internal, "building"],
        ["/usuarios", "Usuários", user.permissions.manage_users, "users"],
        ["/residuos", "Tipos de resíduos", internal, "recycle"],
        ["/tipos-parceiros", "Tipos de parceiros", internal, "tags"],
        [
          "/parceiros",
          "Parceiros",
          user.permissions.read_partners,
          "handshake",
        ],
      ],
    },
    {
      label: "Operação",
      links: [
        [
          "/pesagens/nova",
          "Registrar pesagem",
          user.permissions.create_weighing,
          "scale",
        ],
        ["/pesagens", "Histórico de pesagens", canReadWeighings, "history"],
        ["/relatorios", "Relatórios", canReadWeighings, "clipboard"],
      ],
    },
  ];
  const current = groups
    .flatMap((group) => group.links)
    .find(([to]) => to === location.pathname);
  const title =
    current?.[1] ||
    (location.pathname === "/perfil" ? "Meu perfil" : "Detalhe da pesagem");
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const scope =
    user.role === "super_admin"
      ? "Organização"
      : user.partner_id
        ? "Parceiro"
        : "Agência";

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
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-menu-open" : ""}`}
    >
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="sidebar" aria-label="Menu principal">
        <NavLink
          className="brand"
          to="/"
          title="Ir ao dashboard"
          onClick={() => setMobileOpen(false)}
        >
          <img src="/images/sicredi-logo.png" alt="Sustenta Sicredi" />
          <span>Sustenta Sicredi · Gestão de resíduos</span>
        </NavLink>
        <button
          className="sidebar-collapse icon-button"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={14} />
        </button>
        <nav aria-label="Navegação principal">
          {groups.map(
            (group) =>
              group.links.some(([, , visible]) => visible) && (
                <div className="nav-group" key={group.label}>
                  <p className="nav-label">{group.label}</p>
                  {group.links
                    .filter(([, , visible]) => visible)
                    .map(([to, label, , icon]) => (
                      <NavLink
                        key={to}
                        to={to}
                        title={label}
                        end={to === "/" || to === "/pesagens"}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon name={icon} size={18} />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                </div>
              ),
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-account">
            <NavLink to="/perfil" onClick={() => setMobileOpen(false)}>
              <span className="avatar">{initials}</span>
              <span className="account-copy">
                <strong>{user.name}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
              <Icon name="chevron-right" size={14} />
            </NavLink>
            <button
              className="icon-button"
              aria-label={signingOut ? "Saindo…" : "Sair"}
              title="Sair"
              onClick={handleLogout}
              disabled={signingOut}
            >
              <Icon name="logout" />
            </button>
          </div>
          <small className="app-version">v 1.0.0</small>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-toggle"
            aria-label="Abrir menu"
            onClick={() => {
              setCollapsed(false);
              setMobileOpen(true);
            }}
          >
            <Icon name="menu" />
          </button>
          <strong className="topbar-title">{title}</strong>
          <span className="role-badge">{roleLabels[user.role]}</span>
          <span className="scope-label">· &nbsp; Escopo: {scope}</span>
          <div className="topbar-actions">
            <ThemeToggle />
            <NavLink
              className="topbar-account"
              to="/perfil"
              title="Ver meu perfil"
            >
              <span className="avatar">{initials}</span>
              <span>{user.name}</span>
            </NavLink>
          </div>
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
