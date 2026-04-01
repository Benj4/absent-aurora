import type { User } from '@supabase/auth-js';
import { supabase } from './supabase';

export const AUTH_SESSION_EVENT = 'absent-aurora:auth-session-change';

export interface AuthSessionState {
  user: User | null;
  ready: boolean;
}

type Listener = () => void;

let state: AuthSessionState = {
  user: null,
  ready: false,
};

let initPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emitState(): void {
  for (const listener of listeners) {
    listener();
  }

  if (typeof window !== 'undefined') {
    const win = window as Window & { __AA_AUTH_SESSION__?: AuthSessionState };
    win.__AA_AUTH_SESSION__ = state;

    window.dispatchEvent(
      new CustomEvent<AuthSessionState>(AUTH_SESSION_EVENT, {
        detail: state,
      }),
    );
  }
}

function setState(next: Partial<AuthSessionState>): void {
  state = {
    ...state,
    ...next,
  };
  emitState();
}

export function getAuthSessionSnapshot(): AuthSessionState {
  return state;
}

export function subscribeAuthSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getClientAuthSession(): AuthSessionState {
  if (typeof window === 'undefined') {
    return state;
  }

  const win = window as Window & { __AA_AUTH_SESSION__?: AuthSessionState };
  return win.__AA_AUTH_SESSION__ ?? state;
}

export async function initializeAuthSession(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // getSession() hydrates from local persisted auth state and avoids
      // an unnecessary user fetch on every island mount/navigation.
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching user session:', error);
      }

      setState({ user: data?.session?.user ?? null, ready: true });
    } catch (error) {
      console.error('Unexpected error fetching user session:', error);
      setState({ user: null, ready: true });
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, ready: true });
    });
    void data;
  })();

  return initPromise;
}
