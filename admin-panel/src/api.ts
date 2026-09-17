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

export async function fetchVotes(): Promise<Vote[]> {
  const res = await fetch(`${SERVER_URL}/votes`, { headers: authHeaders() });
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

export function connectVotesSocket(onVote: (vote: Vote) => void): () => void {
  const token = getToken() ?? "";
  const ws = new WebSocket(
    `${SERVER_URL.replace("http", "ws")}/ws?token=${encodeURIComponent(token)}`,
  );
  ws.onmessage = (event) => {
    onVote(JSON.parse(event.data));
  };
  return () => ws.close(1000);
}
