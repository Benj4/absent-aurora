import { defineConfig } from 'cf/config';

export default defineConfig({
  accountId: 'e868d8631a8f4ce28fc234b5d8a506ce',
  worker: {
    name: 'absent-aurora',
    compatibilityDate: '2026-11-13',
    workersDev: true,
    previewUrls: false,
    assets: {
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
});
