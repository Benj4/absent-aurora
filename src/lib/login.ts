import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type LoginAuth = Pick<SupabaseClient<Database>['auth'], 'signInWithPassword' | 'signUp'>;
export type LoginResult =
  | { status: 'authenticated' | 'confirmation' | 'credentials' }
  | { status: 'error'; message: string };

export function authErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  }
  if (error.code === 'email_not_confirmed') return 'Confirma tu correo electrónico antes de iniciar sesión.';
  if (error.code === 'weak_password') return 'Elige una contraseña más segura, con al menos 6 caracteres.';
  if (error.code === 'same_password') return 'Elige una contraseña diferente de la anterior.';
  if (error.code === 'signup_disabled') return 'El registro no está disponible. Si ya tienes una cuenta, puedes recuperar tu contraseña.';
  return 'No pudimos completar la solicitud. Revisa tu conexión e inténtalo de nuevo.';
}

export async function loginOrSignUp(auth: LoginAuth, email: string, password: string, emailRedirectTo: string): Promise<LoginResult> {
  const login = await auth.signInWithPassword({ email, password });
  if (!login.error) return login.data.session
    ? { status: 'authenticated' }
    : { status: 'error', message: 'No se pudo iniciar la sesión. Inténtalo de nuevo.' };
  if (login.error.code !== 'invalid_credentials') return { status: 'error', message: authErrorMessage(login.error) };
  // Supabase uses the same login error for missing accounts and wrong passwords.
  if (password.length < 6) return { status: 'credentials' };
  const signup = await auth.signUp({ email, password, options: { emailRedirectTo } });
  if (signup.error) {
    if (signup.error.code === 'user_already_exists' || signup.error.code === 'email_exists') return { status: 'credentials' };
    return { status: 'error', message: authErrorMessage(signup.error) };
  }
  if (signup.data.session) return { status: 'authenticated' };
  // Confirmation-enabled projects can conceal existing accounts with empty identities.
  if (signup.data.user?.identities?.length === 0) return { status: 'credentials' };
  return { status: 'confirmation' };
}
