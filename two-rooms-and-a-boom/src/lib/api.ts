export { normalizeCode } from "@shared/game/codes";

const SESSION_KEY = "trab.session";

export interface Session {
  code: string;
  playerId: string;
  secret: string;
  name: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export interface CreateRoomResponse {
  code: string;
  playerId: string;
  secret: string;
  playsetId: string;
  playerCount: number;
}

export async function createRoom(hostName: string): Promise<CreateRoomResponse> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Could not create room");
  }
  return res.json() as Promise<CreateRoomResponse>;
}

export function wsUrl(code: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/rooms/${encodeURIComponent(code)}/ws`;
}
