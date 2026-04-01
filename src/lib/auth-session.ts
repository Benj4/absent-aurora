import type { User } from '@supabase/auth-js';
import { supabase } from './supabase';

export const AUTH_SESSION_EVENT = 'absent-aurora:auth-session-change';
const AUTH_SESSION_STORAGE_KEY = 'absent-aurora:auth-session-state';

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

function persistState(nextState: AuthSessionState): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!nextState.user) {
      window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({ user: nextState.user }),
    );
  } catch {
    // Ignore storage errors (private mode, quota, etc.) and keep runtime state.
  }
}

function hydrateStateFromCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const win = window as Window & { __AA_AUTH_SESSION__?: AuthSessionState };
  if (win.__AA_AUTH_SESSION__) {
    state = win.__AA_AUTH_SESSION__;
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as { user?: User | null };
    state = {
      user: parsed.user ?? null,
      ready: true,
    };
  } catch {
    // Ignore malformed cache and let auth events recover state.
  }
}

function emitState(): void {
  for (const listener of listeners) {
    listener();
  }

  if (typeof window !== 'undefined') {
    persistState(state);

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

  if (!state.ready) {
    hydrateStateFromCache();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, ready: true });
    });
    void data;
  })();

  return initPromise;
}
