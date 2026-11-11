import { afterAll } from 'vitest';
import { closeE2EBrowsers } from './e2e-browser.mjs';

afterAll(closeE2EBrowsers, 15000);
