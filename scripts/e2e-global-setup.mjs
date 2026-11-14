import { preflight } from './e2e-preflight.mjs';
import { closeE2EBrowsers } from './e2e-browser.mjs';

export default async function setup() {
  await preflight();
  return closeE2EBrowsers;
}
