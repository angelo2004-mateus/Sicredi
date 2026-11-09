import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { Icon } from "../components/Icon.jsx";
import { canAccessPage } from "../services/access.js";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../hooks/use-session.jsx";
import { ErrorMessage, Loading } from "../components/Feedback.jsx";

export function LoginPage() {
  const { user, loading, error: sessionError, retry, login } = useSession();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (loading) return <Loading message="Verificando sessão…" />;

  if (user)
    return (
      <Navigate
        to={
          canAccessPage(user, location.state?.from) ? location.state.from : "/"
        }
        replace
      />
    );

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);

    try {
      await login({ email: form.get("email"), password: form.get("password") });
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero-content">
          <div className="login-logo">
            <img src="/images/sicredi-logo.png" alt="Sicredi" />
          </div>
          <h1>
            Do resíduo ao impacto: inovação para conectar pessoas, dados e
            sustentabilidade.
          </h1>
          <p>
            Cadastre agências, usuários e parceiros, registre o peso de cada
            saco de resíduo e acompanhe indicadores, relatórios e a
            rastreabilidade dos lançamentos — do descarte à destinação final.
          </p>
        </div>
      </section>
      <section className="login-access">
        <ThemeToggle />
        <div className="login-panel">
          <h2>Entrar</h2>
          <p className="muted">Use seu e-mail corporativo.</p>
          <ErrorMessage error={sessionError} onRetry={retry} />
          <ErrorMessage error={error} />
          <form onSubmit={handleSubmit} className="form-stack">
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="voce@sicredi.demo"
                required
                maxLength={254}
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button disabled={pending} type="submit">
              <Icon name="login" /> {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
