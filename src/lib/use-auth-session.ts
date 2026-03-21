import { useEffect, useSyncExternalStore } from 'react';
import {
  getAuthSessionSnapshot,
  initializeAuthSession,
  subscribeAuthSession,
} from './auth-session';

export function useAuthSession() {
  const snapshot = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getAuthSessionSnapshot,
  );

  useEffect(() => {
    void initializeAuthSession();
  }, []);

  return snapshot;
}
