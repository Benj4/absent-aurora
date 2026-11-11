import { config } from 'dotenv';

// Shell variables override .env.local, which overrides .env, as in local Astro setup.
config({ path: ['.env.local', '.env'], quiet: true });
