// ayo-app/online.ts - 1v1 Online Ayò Ọlọ́pọ́n WebSocket hook
import { useState, useEffect, useRef, useCallback } from 'react';
import { ROOMS_API_BASE, getGuestId, saveNickname } from '../core/online';
import type { AyoState, AyoRuleSet } from './engine';

export interface AyoOnlineSeat {
  name: string;
  connected: boolean;
  wins: number;
}

export interface AyoOnlineView {
  code: string;
  phase: 'lobby' | 'playing' | 'over';
  you: number; // 0 = South, 1 = North, -1 = spectator
  seats: AyoOnlineSeat[];
  game: AyoState | null;
}

export interface AyoReaction {
  id: number;
  seat: number;
  emoji: string;
}

export const getAyoInviteUrl = (code: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.jackattackstreets.com';
  return `${origin}/ayo/?room=${encodeURIComponent(code.toUpperCase())}`;
};

export const createAyoOnlineRoom = async (): Promise<string> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/ayo/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('Could not create Ayò room.');
  const data = (await res.json()) as { code?: string };
  if (!data.code) throw new Error('Invalid room response.');
  return data.code.toUpperCase();
};

export const useAyoOnlineRoom = (roomCode: string | null, nickname: string) => {
  const [view, setView] = useState<AyoOnlineView | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<AyoReaction[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const nameRef = useRef(nickname);
  nameRef.current = nickname;

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!roomCode) {
      setView(null);
      return;
    }
    const code = roomCode.toUpperCase().trim();
    const guestId = getGuestId();
    let closed = false;
    let attempt = 0;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const wsUrl = `${ROOMS_API_BASE.replace(/^http/, 'ws')}/api/ayo/rooms/${encodeURIComponent(code)}/ws`;

    const connect = () => {
      if (closed) return;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus('connected');
        setError(null);
        const clean = nameRef.current.trim() || 'Player';
        saveNickname(clean);
        ws.send(JSON.stringify({ t: 'join', id: guestId, name: clean }));
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as
            | { t: 'state'; view: AyoOnlineView }
            | { t: 'react'; seat: number; emoji: string }
            | { t: 'error'; error: string };
          if (msg.t === 'state') {
            setView(msg.view);
          } else if (msg.t === 'react') {
            const rid = Date.now() + Math.random();
            setReactions((prev) => [...prev.slice(-5), { id: rid, seat: msg.seat, emoji: msg.emoji }]);
            window.setTimeout(() => setReactions((p) => p.filter((r) => r.id !== rid)), 2400);
          } else if (msg.t === 'error') {
            setError(msg.error);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
        if (closed) return;
        attempt++;
        if (attempt > 6) {
          setStatus('error');
          setError('Disconnected from room. Please rejoin.');
          return;
        }
        setStatus('reconnecting');
        reconnectTimer = window.setTimeout(connect, Math.min(4000, 600 * attempt));
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (pingTimer !== null) clearInterval(pingTimer);
      if (wsRef.current) {
        try { wsRef.current.close(1000, 'Left'); } catch {}
        wsRef.current = null;
      }
    };
  }, [roomCode]);

  const sendStart = useCallback((ruleSet: AyoRuleSet) => send({ t: 'start', ruleSet }), [send]);
  const sendMove = useCallback((pit: number) => send({ t: 'move', pit }), [send]);
  const sendReact = useCallback((emoji: string) => send({ t: 'react', emoji }), [send]);

  return { view, status, error, clearError: () => setError(null), reactions, sendStart, sendMove, sendReact };
};
