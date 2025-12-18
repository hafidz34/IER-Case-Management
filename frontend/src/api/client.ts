const BASE =
  import.meta.env.VITE_API_BASE_URL?.toString().trim() || "http://localhost:5000";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (typeof payload === "string") {
      message = payload || message;
    } else if (payload && typeof payload === "object") {
      // support {error}, {message}, {detail}
      const p: any = payload;
      message = (p.detail || p.error || p.message || message).toString();
    }
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, "GET"),
  post: <T>(path: string, body: unknown) => request<T>(path, "POST", body),
  put: <T>(path: string, body: unknown) => request<T>(path, "PUT", body),
  delete: <T>(path: string) => request<T>(path, "DELETE"),
};
