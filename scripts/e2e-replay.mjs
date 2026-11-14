import { readFile } from 'node:fs/promises';
import { createRunner, parse } from '@puppeteer/replay';
import { E2EError, localUrl, preflight } from './e2e-preflight.mjs';
import { launchE2EBrowser, closeE2EBrowsers } from './e2e-browser.mjs';
import LoggingExtension from './e2e-replay-logging.mjs';

try {
  const files = process.argv.slice(2).filter(arg => arg !== '--');
  if (!files.length) throw new E2EError('Indica archivos JSON de Recorder.');
  const flows = [];
  for (const file of files) {
    try { flows.push(parse(JSON.parse(await readFile(file, 'utf8')))); }
    catch { throw new E2EError('No se pudo leer una grabación JSON válida. Revisa los archivos indicados.'); }
  }
  const firstNavigation = flows[0].steps.find(step => step.type === 'navigate');
  const base = await preflight(process.env.E2E_BASE_URL || (firstNavigation && localUrl(firstNavigation.url).origin));
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (step.type === 'navigate' && localUrl(step.url).origin !== base.origin) {
        throw new E2EError('La grabación navega a un servidor distinto del verificado. Usa el mismo origen al grabar y ejecutar.');
      }
    }
  }
  for (const [index, flow] of flows.entries()) {
    console.log(`Grabación ${index + 1}/${flows.length}`);
    const browser = await launchE2EBrowser();
    try {
      const page = await browser.newPage();
      const runner = await createRunner(flow, new LoggingExtension(browser, page));
      if (!await runner.run()) throw new E2EError('Grabación interrumpida.');
      console.log('Grabación completada.');
    } finally { await closeE2EBrowsers(); }
  }
} catch (error) {
  console.error(error instanceof E2EError ? error.message : `Falló el paso indicado (${error?.name === 'TimeoutError' ? 'tiempo de espera agotado' : 'error de ejecución'}). Revisa el estado de la página y la sesión.`);
  process.exitCode = 1;
} finally {
  try { await closeE2EBrowsers(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
