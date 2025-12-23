const BASE = import.meta.env.VITE_API_BASE_URL?.toString().trim() || "http://localhost:5000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  responseType?: "json" | "blob" | "text";
}

async function request<T>(path: string, method: HttpMethod, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE}${path}`;
  const headers: HeadersInit = {};
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const config: RequestInit = {
    method,
    headers,
    body: payload,
  };

  const res = await fetch(url, config);

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const payload = isJson ? await res.json() : await res.text();

      if (typeof payload === "string") {
        message = payload || message;
      } else if (payload && typeof payload === "object") {
        const p: any = payload;
        message = (p.detail || p.error || p.message || message).toString();
      }
    } catch (e) {
      // ignore
    }
    throw new Error(message);
  }

  if (options.responseType === "blob") {
    return (await res.blob()) as unknown as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  return isJson ? await res.json() : ((await res.text()) as unknown as T);
}

export const client = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", undefined, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>(path, "POST", body, options),
  put: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>(path, "PUT", body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, "DELETE", undefined, options),
};
