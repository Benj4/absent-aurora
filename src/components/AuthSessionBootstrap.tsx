import { useEffect } from 'react';
import { initializeAuthSession } from '../lib/auth-session';

export default function AuthSessionBootstrap() {
  useEffect(() => {
    void initializeAuthSession();
  }, []);

  return null;
}
