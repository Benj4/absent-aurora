import { preflight, E2EError } from './e2e-preflight.mjs';
import { launchE2EBrowser, closeE2EBrowsers } from './e2e-browser.mjs';

try {
  await preflight();
  const browser = await launchE2EBrowser();
  await browser.newPage();
  if (process.argv.includes('--inspect')) {
    console.log('Chrome listo, sin ejecutar acciones. Pulsa Ctrl+C para cerrar.');
    await new Promise(() => {});
  }
} catch (error) {
  console.error(error instanceof E2EError ? error.message : 'Falló la comprobación del entorno E2E.');
  process.exitCode = 1;
} finally {
  try { await closeE2EBrowsers(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
