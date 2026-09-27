import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentAction } from '../components/LabAssistant';
import { logService } from '../services/logService';

const getWebSocketUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/^http/, 'ws');
  }

  // In production (Vercel HTTPS), connect directly to the VPS tunnel to avoid local network probes
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'wss://unheard-revoke-goofiness.ngrok-free.dev';
  }

  return 'ws://localhost:8001';
};

const WS_URL = getWebSocketUrl();

export function useMultiplayer(roomId: string | null, onRemoteAction: (action: AgentAction) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // We need to keep the latest callback in a ref so the websocket listener always calls the freshest one
  // without needing to re-bind the websocket on every render.
  const onRemoteActionRef = useRef(onRemoteAction);
  useEffect(() => {
    onRemoteActionRef.current = onRemoteAction;
  }, [onRemoteAction]);

  useEffect(() => {
    if (!roomId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const ws = new WebSocket(`${WS_URL}/ws/multiplayer/${roomId}`);
    
    ws.onopen = () => {
      logService.info(`[Multiplayer] Connected to room ${roomId}`);
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type) {
          logService.info(`[Multiplayer] Received remote action: ${data.type}`);
          onRemoteActionRef.current(data as AgentAction);
        }
      } catch (err) {
        logService.error('[Multiplayer] Failed to parse incoming message', err);
      }
    };

    ws.onclose = () => {
      logService.info(`[Multiplayer] Disconnected from room ${roomId}`);
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      logService.error('[Multiplayer] WebSocket error', error);
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [roomId]);

  const broadcastAction = useCallback((action: AgentAction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(action));
    }
  }, []);

  return { isConnected, broadcastAction };
}
