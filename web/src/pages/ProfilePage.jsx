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
      <PageHeader title="Meu perfil" description={roleLabels[user.role]} />
      <ErrorMessage error={mutation.error} />
      {saved && <p role="status">Nome atualizado.</p>}
      <form className="panel form-stack narrow" onSubmit={handleSubmit}>
        <label>
          Nome
          <input
            name="name"
            required
            maxLength={255}
            defaultValue={user.name}
          />
        </label>
        <label>
          E-mail
          <input type="email" value={user.email} readOnly />
        </label>
        <button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "Salvando…" : "Salvar nome"}
        </button>
      </form>
    </>
  );
}
