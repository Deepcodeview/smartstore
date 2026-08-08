/* hooks/useWebSocket.js — Real-time WebSocket connection */
import { useEffect, useRef, useCallback } from 'react';

export default function useWebSocket(url, onMessage, enabled = true) {
  const ws      = useRef(null);
  const retry   = useRef(0);
  const maxRetry = 5;

  const connect = useCallback(() => {
    if (!enabled || !url) return;
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => { retry.current = 0; };

      ws.current.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)); }
        catch (err) { /* non-JSON frame */ }
      };

      ws.current.onclose = () => {
        if (retry.current < maxRetry) {
          retry.current++;
          setTimeout(connect, 2000 * retry.current);
        }
      };

      ws.current.onerror = () => ws.current?.close();
    } catch { /* WebSocket not available in this env */ }
  }, [url, onMessage, enabled]);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
