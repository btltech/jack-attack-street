// core/online.ts - Guest identity & WebSocket client hook for online rooms
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Card, Suit, Difficulty } from './types';
import type { View, ServerMsg, ClientMsg } from './roomEngine';

const DEFAULT_API_BASE = 'https://jack-attack-rooms.btltech.workers.dev';
export const ROOMS_API_BASE: string =
  (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ROOMS_API_URL) ||
  DEFAULT_API_BASE;

const GUEST_ID_KEY = 'jack-attack-guest-id';
const NICKNAME_KEY = 'jack-attack-nickname';

export const getGuestId = (): string => {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return `guest-${Math.random().toString(36).slice(2)}`;
  }
};

export const loadNickname = (): string => {
  try {
    return localStorage.getItem(NICKNAME_KEY) || '';
  } catch {
    return '';
  }
};

export const saveNickname = (name: string): void => {
  try {
    localStorage.setItem(NICKNAME_KEY, name.trim().slice(0, 16));
  } catch {
    // ignore storage errors
  }
};

export const getRoomInviteUrl = (code: string): string => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.jackattackstreets.com';
  return `${origin}/jackattack/?room=${encodeURIComponent(code.toUpperCase())}`;
};

export const createOnlineRoom = async (): Promise<string> => {
  const res = await fetch(`${ROOMS_API_BASE}/api/rooms`, { method: 'POST' });
  if (!res.ok) {
    throw new Error('Could not create room. Please try again.');
  }
  const data = (await res.json()) as { code?: string };
  if (!data.code) {
    throw new Error('Invalid room response from server.');
  }
  return data.code.toUpperCase();
};

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface OnlineRoomHook {
  view: View | null;
  status: ConnectionStatus;
  error: string | null;
  clearError: () => void;
  peek: { card: Card; seat: number } | null;
  clearPeek: () => void;
  clockOffsetMs: number;
  sendStart: (size: number, difficulty: Difficulty) => void;
  sendPlay: (cardId: string) => void;
  sendDraw: () => void;
  sendSuit: (suit: Suit) => void;
  sendSwap: (seat: number) => void;
  updateName: (name: string) => void;
}

export const useOnlineRoom = (roomCode: string, nickname: string): OnlineRoomHook => {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ card: Card; seat: number } | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const nameRef = useRef<string>(nickname);
  nameRef.current = nickname;

  const sendMsg = useCallback((msg: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    const code = roomCode.toUpperCase().trim();
    const guestId = getGuestId();
    let closedByUser = false;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let attempt = 0;

    const wsUrl = `${ROOMS_API_BASE.replace(/^http/, 'ws')}/api/rooms/${encodeURIComponent(code)}/ws`;

    const connect = () => {
      if (closedByUser) return;
      setStatus(attempt === 0 ? 'connecting' : 'reconnecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus('connected');
        setError(null);
        ws.send(JSON.stringify({
          t: 'join',
          id: guestId,
          name: nameRef.current.trim() || 'Player',
        } satisfies ClientMsg));

        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ t: 'ping' } satisfies ClientMsg));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerMsg;
          if (msg.t === 'state') {
            setView(msg.view);
            setClockOffsetMs(msg.now - Date.now());
          } else if (msg.t === 'peek') {
            setPeek({ card: msg.card, seat: msg.seat });
          } else if (msg.t === 'error') {
            setError(msg.error);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (pingTimer !== null) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (closedByUser) return;
        attempt++;
        if (attempt > 6) {
          setStatus('error');
          setError('Disconnected from room. Please rejoin.');
          return;
        }
        setStatus('reconnecting');
        const delay = Math.min(4000, 600 * attempt);
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (pingTimer !== null) clearInterval(pingTimer);
      if (wsRef.current) {
        try { wsRef.current.close(1000, 'Left room'); } catch {}
        wsRef.current = null;
      }
    };
  }, [roomCode]);

  const sendStart = useCallback((size: number, difficulty: Difficulty) => {
    sendMsg({ t: 'start', size, difficulty });
  }, [sendMsg]);

  const sendPlay = useCallback((cardId: string) => {
    sendMsg({ t: 'play', cardId });
  }, [sendMsg]);

  const sendDraw = useCallback(() => {
    sendMsg({ t: 'draw' });
  }, [sendMsg]);

  const sendSuit = useCallback((suit: Suit) => {
    sendMsg({ t: 'suit', suit });
  }, [sendMsg]);

  const sendSwap = useCallback((seat: number) => {
    sendMsg({ t: 'swap', seat });
  }, [sendMsg]);

  const updateName = useCallback((name: string) => {
    saveNickname(name);
    sendMsg({ t: 'join', id: getGuestId(), name: name.trim() || 'Player' });
  }, [sendMsg]);

  return {
    view,
    status,
    error,
    clearError: useCallback(() => setError(null), []),
    peek,
    clearPeek: useCallback(() => setPeek(null), []),
    clockOffsetMs,
    sendStart,
    sendPlay,
    sendDraw,
    sendSuit,
    sendSwap,
    updateName,
  };
};
