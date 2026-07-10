import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, PublicState, ServerMessage } from "@shared/game/types";
import { type Session, loadSession, saveSession, wsUrl } from "@/lib/api";

type ConnStatus = "offline" | "connecting" | "live" | "reconnecting";

export function useGameSocket(code: string | null, initialName: string) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    if (code && s?.code === code) return s;
    if (code) return { code, playerId: "", secret: "", name: initialName || "Player" };
    return s;
  });
  const [state, setState] = useState<PublicState | null>(null);
  const [conn, setConn] = useState<ConnStatus>("offline");
  const [error, setError] = useState<string>("");
  const [clockSkew, setClockSkew] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const intentionalClose = useRef(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(0);
  const heartbeatTimer = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    saveSession(next);
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    clearTimeout(reconnectTimer.current);
    clearInterval(heartbeatTimer.current);
    wsRef.current?.close(1000, "leave");
    wsRef.current = null;
    setConn("offline");
    setState(null);
    applySession(null);
  }, [applySession]);

  const connect = useCallback(() => {
    const s = sessionRef.current;
    if (!s?.code) return;

    intentionalClose.current = false;
    setConn(reconnectAttempt.current ? "reconnecting" : "connecting");
    setError("");

    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }

    const ws = new WebSocket(wsUrl(s.code));
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      reconnectAttempt.current = 0;
      setConn("live");
      const cur = sessionRef.current;
      ws.send(
        JSON.stringify({
          type: "hello",
          name: cur?.name || initialName || "Player",
          playerId: cur?.playerId || undefined,
          secret: cur?.secret || undefined,
        } satisfies ClientMessage)
      );
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
        }
      }, 25000);
    });

    ws.addEventListener("message", (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === "welcome") {
        const next: Session = {
          code: sessionRef.current?.code || s.code,
          playerId: msg.playerId,
          secret: msg.secret,
          name: msg.state.you?.name || sessionRef.current?.name || initialName,
        };
        applySession(next);
        setClockSkew(msg.state.serverTime - Date.now());
        setState(msg.state);
        setError("");
        return;
      }
      if (msg.type === "state") {
        setClockSkew(msg.state.serverTime - Date.now());
        setState(msg.state);
        return;
      }
      if (msg.type === "error") {
        setError(msg.message);
        return;
      }
      if (msg.type === "pong") {
        setClockSkew(msg.t - Date.now());
      }
    });

    ws.addEventListener("close", () => {
      clearInterval(heartbeatTimer.current);
      if (intentionalClose.current) {
        setConn("offline");
        return;
      }
      setConn("reconnecting");
      const delay = Math.min(8000, 500 * 2 ** reconnectAttempt.current + Math.random() * 300);
      reconnectAttempt.current += 1;
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = window.setTimeout(() => connect(), delay);
    });
  }, [applySession, initialName]);

  useEffect(() => {
    if (!session?.code) return;
    connect();
    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      clearInterval(heartbeatTimer.current);
      wsRef.current?.close(1000, "unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.code]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && sessionRef.current?.code) {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) connect();
        else send({ type: "ping" });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [connect, send]);

  const updateName = useCallback(
    (name: string) => {
      const cleaned = name.trim();
      if (!cleaned || !session) return;
      applySession({ ...session, name: cleaned });
      send({ type: "set_name", name: cleaned });
    },
    [applySession, send, session]
  );

  return {
    session,
    state,
    conn,
    error,
    setError,
    clockSkew,
    send,
    disconnect,
    updateName,
    applySession,
    connect,
  };
}
