import puppeteer from 'puppeteer';
import { E2EError } from './e2e-preflight.mjs';

const owned = new Set();
let interrupted = false;
function alive(child) { return child && child.exitCode === null && child.signalCode === null; }

async function close(browser) {
  const child = browser.process();
  let timer;
  try {
    await Promise.race([
      browser.close().catch(() => {}),
      new Promise(resolve => { timer = setTimeout(resolve, 5000); }),
    ]);
  } finally { clearTimeout(timer); }
  if (alive(child)) {
    // Puppeteer owns a detached process group on POSIX; never target a server group.
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 3000);
      child.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  if (alive(child)) throw new E2EError('No se pudo confirmar el cierre de Chrome.');
}

export async function closeE2EBrowsers() {
  const results = await Promise.allSettled([...owned].map(async pending => {
    const browser = await pending.catch(() => null);
    if (browser) await close(browser);
    owned.delete(pending);
  }));
  if (results.some(result => result.status === 'rejected')) throw new E2EError('No se pudo confirmar el cierre de todos los navegadores.');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (interrupted) return;
    interrupted = true;
    console.error('Ejecución interrumpida. Cerrando Chrome…');
    try { await closeE2EBrowsers(); }
    catch { console.error('No se pudo confirmar el cierre de Chrome.'); }
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

export async function launchE2EBrowser() {
  if (interrupted) throw new E2EError('Ejecución interrumpida.');
  const pending = puppeteer.launch({
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: true,
  });
  owned.add(pending);
  try {
    const browser = await pending;
    console.log(`Navegador: ${await browser.version()}`);
    return browser;
  } catch {
    throw new E2EError('No se pudo iniciar Chrome. Ejecuta pnpm run e2e:install y comprueba las dependencias del sistema y los permisos del sandbox.');
  }
}
