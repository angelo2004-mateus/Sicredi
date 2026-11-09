import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, clearSessionToken } from "../services/api.js";

const SessionContext = createContext(null);

async function fetchSession() {
  try {
    return await api("/me", { publicRequest: true });
  } catch (error) {
    if (error.status === 401) return null;

    throw error;
  }
}

export function SessionProvider({ children }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    retry: false,
  });

  useEffect(() => {
    function expire() {
      queryClient.cancelQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      queryClient.setQueryData(["session"], null);
    }

    window.addEventListener("session-expired", expire);

    return () => window.removeEventListener("session-expired", expire);
  }, [queryClient]);

  async function login(credentials) {
    await api("/auth/login", {
      method: "POST",
      body: credentials,
      publicRequest: true,
    });

    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });

    const user = await fetchSession();

    if (!user) throw new Error("Não foi possível recuperar a sessão.");

    queryClient.setQueryData(["session"], user);

    return user;
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) throw error;
    }

    clearSessionToken();
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    queryClient.setQueryData(["session"], null);
  }

  return (
    <SessionContext.Provider
      value={{
        user: session.data,
        loading: session.isPending,
        error: session.error,
        retry: session.refetch,
        login,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
