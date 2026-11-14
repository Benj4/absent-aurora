import { useEffect, useRef, useState, type InputHTMLAttributes, type SubmitEvent } from 'react';
import { supabase } from '../lib/supabase';
import { authErrorMessage, loginOrSignUp } from '../lib/login';
import { withBase } from '../lib/paths';

type Mode = 'login' | 'recover' | 'update';

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className="input w-full pr-12" />
      <button type="button" onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
        aria-controls={props.id} title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="btn btn-ghost btn-square btn-sm absolute right-1 top-1/2 z-10 -translate-y-1/2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
}

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const recoveryToken = document.getElementById('login-page')?.dataset.recovery === 'true'
      || new URLSearchParams(url.hash.slice(1)).get('type') === 'recovery';
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
        setPassword('');
        setMessage('');
        setFailed(false);
      }
    });
    if (recoveryToken || url.searchParams.has('recovery')) {
      setMode('recover');
      setBusy(true);
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;
        if (!error && recoveryToken && data.session) setMode('update');
        else {
          setFailed(true);
          setMessage('El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.');
        }
      }).catch(() => {
        if (!mounted) return;
        setFailed(true);
        setMessage('No pudimos verificar el enlace. Solicita uno nuevo.');
      }).finally(() => { if (mounted) setBusy(false); });
    }
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setMessage('');
    setFailed(false);
    setPassword('');
    setConfirmation('');
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || busy) return;
    if (mode === 'update' && password !== confirmation) {
      setFailed(true);
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    setMessage('');
    try {
      const loginUrl = new URL(withBase('/login'), window.location.origin);
      if (mode === 'recover') {
        loginUrl.searchParams.set('recovery', '1');
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: loginUrl.href });
        if (error) { setFailed(true); setMessage(authErrorMessage(error)); return; }
        setMessage('Si hay una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.');
        return;
      }
      if (mode === 'update') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { setFailed(true); setMessage(authErrorMessage(error)); return; }
        window.location.assign(withBase('/'));
        return;
      }
      const result = await loginOrSignUp(supabase.auth, email.trim(), password, loginUrl.href);
      if (result.status === 'authenticated') window.location.assign(withBase('/'));
      else if (result.status === 'confirmation') {
        setPassword('');
        setShowRecovery(true);
        setMessage('Revisa tu correo para confirmar tu cuenta.');
      } else {
        setFailed(true);
        setShowRecovery(true);
        setMessage(result.status === 'error' ? result.message
          : 'No pudimos iniciar sesión. Revisa tu correo y contraseña o recupera el acceso.');
      }
    } catch {
      setFailed(true);
      setMessage('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Iniciar sesión' : mode === 'recover' ? 'Recuperar contraseña' : 'Crea una nueva contraseña';
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12" aria-labelledby="login-title">
      <div className="card w-full border border-base-300 bg-base-200 p-6 shadow-sm sm:p-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-base-content/60">Absent Aurora</p>
        <h1 id="login-title" className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-base-content/70">
          {mode === 'login' ? 'Accede con tu correo y contraseña. Si aún no tienes cuenta, intentaremos crearla con estos datos.'
            : mode === 'recover' ? 'Te enviaremos un enlace para recuperar el acceso a tu cuenta.'
              : 'Elige una contraseña de al menos 6 caracteres para volver a acceder.'}
        </p>
        <form method="post" onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-5">
            {mode !== 'update' && <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Correo electrónico</label>
              <input id="login-email" name="email" type="email" autoComplete="email" required value={email}
                onChange={(event) => setEmail(event.target.value)} className="input w-full" placeholder="tu@correo.cl" />
            </div>}
            {mode !== 'recover' && <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium">{mode === 'update' ? 'Nueva contraseña' : 'Contraseña'}</label>
              <PasswordInput key={mode} id="login-password" name="password" autoComplete={mode === 'update' ? 'new-password' : 'current-password'}
                minLength={mode === 'update' ? 6 : undefined} required value={password}
                onChange={(event) => setPassword(event.target.value)} />
            </div>}
            {mode === 'update' && <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Confirma la nueva contraseña</label>
              <PasswordInput id="confirm-password" name="confirmation" autoComplete="new-password" minLength={6} required value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)} />
            </div>}
            <button type="submit" className="btn btn-primary w-full">
              {busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : mode === 'recover' ? 'Enviar enlace de recuperación' : 'Guardar contraseña'}
            </button>
          </fieldset>
          <div aria-live="polite" aria-atomic="true">
            {message && <p role={failed ? 'alert' : 'status'} className={`text-sm ${failed ? 'text-error' : 'text-success'}`}>{message}</p>}
          </div>
        </form>
        {mode === 'login' && <button type="button" disabled={busy} onClick={() => changeMode('recover')}
          className={`btn mt-4 w-full ${showRecovery ? 'btn-outline btn-primary' : 'btn-ghost btn-sm'}`}>
          {showRecovery ? 'Recuperar contraseña' : '¿Olvidaste tu contraseña?'}
        </button>}
        {mode === 'recover' && <button type="button" disabled={busy} onClick={() => changeMode('login')} className="btn btn-ghost mt-4 w-full">Volver a iniciar sesión</button>}
      </div>
    </section>
  );
}
