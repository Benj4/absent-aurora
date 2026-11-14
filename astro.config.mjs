// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubPagesBuild = process.env.DEPLOY_TARGET === 'github-pages';
if (isGitHubPagesBuild && (!owner || !repo)) {
  throw new Error('GitHub Pages rollback requires GITHUB_REPOSITORY_OWNER and GITHUB_REPOSITORY');
}

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://absent-aurora.bdiazcaballero.workers.dev',
  base: '/',
  ...(isGitHubPagesBuild
    ? {
        site: `https://${owner}.github.io`,
        base: `/${repo}`
      }
    : {}),
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
  },

  integrations: [react()]
});
