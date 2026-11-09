export function Loading({ message = "Carregando…" }) {
  return (
    <p role="status" className="feedback">
      {message}
    </p>
  );
}

export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;

  const details = Object.values(error.fields || {}).flat();

  return (
    <div role="alert" className="feedback feedback-error">
      <p>{error.message || "Ocorreu um erro. Tente novamente."}</p>
      {details.length > 0 && (
        <ul>
          {details.map((detail, index) => (
            <li key={index}>{detail}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children = "Nenhum registro encontrado." }) {
  return <p className="feedback">{children}</p>;
}
