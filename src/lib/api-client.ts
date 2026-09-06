/**
 * Thin fetch wrapper that understands the API's error envelope, so every
 * caller gets a real Error with a code and per-field messages instead of
 * having to unwrap JSON by hand.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiClientError(
      error?.message ?? "Request failed",
      error?.code ?? "UNKNOWN",
      response.status,
      error?.fields,
    );
  }

  return payload as T;
}

export type SessionResponse = {
  user: { id: string; phone: string; name: string | null; role: string } | null;
  restaurantId: string | null;
};
