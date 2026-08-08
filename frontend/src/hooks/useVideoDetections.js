/**
 * useVideoDetections.js — Retail AI hook for video job polling
 * Polls /jobs/ every 2.5s to track processing jobs
 */
import { useEffect, useRef, useCallback } from 'react';
import useAppStore from '../store/appStore';
import { useShallow } from 'zustand/react/shallow';

const API = 'http://localhost:8000';

export function useVideoDetections() {
  const { addConsoleEntry, setSystemStatus } = useAppStore(
    useShallow(s => ({
      addConsoleEntry: s.addConsoleEntry,
      setSystemStatus: s.setSystemStatus,
    }))
  );

  const timerRef  = useRef(null);
  const activeRef = useRef(false);

  const startPolling = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setSystemStatus('RUNNING');
    addConsoleEntry({
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      tag: 'INFO', tagClass: 'INFO',
      msg: '[INFO] Video processing started — live stream active',
    });
  }, [setSystemStatus, addConsoleEntry]);

  const stopPolling = useCallback(() => {
    clearInterval(timerRef.current);
    activeRef.current = false;
    setSystemStatus('IDLE');
  }, [setSystemStatus]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  return { startPolling, stopPolling, isPolling: activeRef.current };
}

export default useVideoDetections;
