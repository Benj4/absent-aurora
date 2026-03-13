// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubPagesBuild = Boolean(process.env.GITHUB_ACTIONS && owner && repo);

// https://astro.build/config
export default defineConfig({
  ...(isGitHubPagesBuild
    ? {
        site: `https://${owner}.github.io`,
        base: `/${repo}`
      }
    : {}),
  vite: {
    plugins: [tailwindcss()],
    // ssr: {
    //   noExternal: ['antd', '@ant-design/icons', '@ant-design/cssinjs']
    // }
  },

  integrations: [react()]
});