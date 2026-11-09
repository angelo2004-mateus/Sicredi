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
      <section className="panel login-panel">
        <p className="muted">Programa Lixo Zero · Sicredi</p>
        <h1>Acessar o sistema</h1>
        <p>Entre com os dados fornecidos pela administração.</p>
        <ErrorMessage error={sessionError} onRetry={retry} />
        <ErrorMessage error={error} />
        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="username"
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
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="muted">
          Para recuperar seu acesso, procure o administrador.
        </p>
      </section>
    </main>
  );
}
