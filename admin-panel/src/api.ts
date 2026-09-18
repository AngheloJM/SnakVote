import type { Vote } from "./types";

// TODO: mover a variable de entorno (VITE_SERVER_URL) al desplegar.
export const SERVER_URL = "http://127.0.0.1:3000";

const TOKEN_KEY = "snakvote_admin_token";

export class AuthError extends Error {}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Correo o contraseña incorrectos");
  const data: { token: string } = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchVotes(range?: { from?: Date; to?: Date }): Promise<Vote[]> {
  const params = new URLSearchParams();
  if (range?.from) params.set("from", range.from.toISOString());
  if (range?.to) params.set("to", range.to.toISOString());
  const qs = params.toString();
  const res = await fetch(`${SERVER_URL}/votes${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error("no se pudieron cargar los votos");
  return res.json();
}

export async function updateReason(id: string, reason: string): Promise<Vote> {
  const res = await fetch(`${SERVER_URL}/votes/${id}/reason`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error("no se pudo guardar el motivo");
  return res.json();
}

export function photoUrl(photoKey: string): string {
  const token = getToken() ?? "";
  return `${SERVER_URL}/uploads/${photoKey}?token=${encodeURIComponent(token)}`;
}

export function connectVotesSocket(
  onVote: (vote: Vote) => void,
  onStatusChange?: (connected: boolean) => void,
): () => void {
  let closedByCaller = false;
  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 1000;
  const maxRetryDelay = 15000;

  function connect() {
    const token = getToken() ?? "";
    ws = new WebSocket(
      `${SERVER_URL.replace("http", "ws")}/ws?token=${encodeURIComponent(token)}`,
    );

    ws.onopen = () => {
      retryDelay = 1000;
      onStatusChange?.(true);
    };

    ws.onmessage = (event) => {
      onVote(JSON.parse(event.data));
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (closedByCaller) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    closedByCaller = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close(1000);
  };
}
