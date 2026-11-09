const API_BASE = "/api/v1";

let csrfToken = null;
let csrfRequest = null;

export class ApiError extends Error {
  constructor(status, payload) {
    super(
      payload?.error?.message || "Não foi possível concluir a solicitação.",
    );

    this.status = status;
    this.code = payload?.error?.code;
    this.fields = payload?.error?.fields || {};
  }
}

export function clearSessionToken() {
  csrfToken = null;
  csrfRequest = null;
}

async function readResponse(response) {
  if (response.status === 204) return null;

  return response.json().catch(() => null);
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE}/auth/csrf`, { credentials: "include" })
      .then(async (response) => {
        const data = await readResponse(response);

        if (!response.ok) {
          if (response.status === 401)
            window.dispatchEvent(new Event("session-expired"));

          throw new ApiError(response.status, data);
        }

        csrfToken = data.csrf_token;

        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

export async function api(
  path,
  { method = "GET", body, publicRequest = false, signal } = {},
) {
  const mutable = !["GET", "HEAD"].includes(method);

  async function send(retryCsrf = true) {
    const headers = { Accept: "application/json" };

    if (body !== undefined) headers["Content-Type"] = "application/json";

    if (mutable && !publicRequest)
      headers["X-CSRF-Token"] = await getCsrfToken();

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await readResponse(response);

    // Retry only the explicit CSRF rejection, before the server executes a mutation.
    if (
      response.status === 403 &&
      data?.error?.code === "CSRF_INVALID" &&
      retryCsrf
    ) {
      clearSessionToken();

      return send(false);
    }

    if (!response.ok) {
      if (response.status === 401 && !publicRequest) {
        clearSessionToken();
        window.dispatchEvent(new Event("session-expired"));
      }

      throw new ApiError(response.status, data);
    }

    if (path === "/auth/login") csrfToken = data.csrf_token;

    return data;
  }

  return send();
}

export function queryString(filters = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined)
      query.set(key, String(value));
  }

  const encoded = query.toString();

  return encoded ? `?${encoded}` : "";
}
