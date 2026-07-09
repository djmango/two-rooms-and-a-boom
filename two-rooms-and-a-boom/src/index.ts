import { GameRoom, type Env } from "./game-room";
import { generateCode, isValidCode, normalizeCode } from "./game/codes";
import { PLAYSETS, PACKS } from "./game/deck";

export { GameRoom };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    // Meta
    if (url.pathname === "/api/meta") {
      return json({
        playsets: PLAYSETS,
        packs: PACKS,
      });
    }

    // Create room → random three-word code, Durable Object per code
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body: { hostName?: string; playsetId?: string; playerCount?: number } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch {
        /* empty */
      }

      let code = "";
      let created = null as Response | null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        code = generateCode();
        const stub = env.GAME_ROOM.getByName(code);
        const res = await stub.fetch(
          new Request(`https://room/create?code=${encodeURIComponent(code)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        );
        if (res.status === 409) continue;
        created = res;
        break;
      }
      if (!created) return json({ error: "Could not allocate a room code. Try again." }, 503);
      return created;
    }

    // Room info
    const infoMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/info$/);
    if (infoMatch && request.method === "GET") {
      const code = normalizeCode(decodeURIComponent(infoMatch[1]!));
      if (!isValidCode(code)) return json({ error: "Invalid room code" }, 400);
      const stub = env.GAME_ROOM.getByName(code);
      return stub.fetch(new Request("https://room/info"));
    }

    // WebSocket upgrade → room
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (wsMatch) {
      const code = normalizeCode(decodeURIComponent(wsMatch[1]!));
      if (!isValidCode(code)) return json({ error: "Invalid room code" }, 400);
      const stub = env.GAME_ROOM.getByName(code);
      return stub.fetch(new Request("https://room/ws", request));
    }

    // Static assets (SPA)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
