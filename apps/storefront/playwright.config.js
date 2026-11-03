import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 testMatch:'**/*.spec.js',
 timeout:25000,
 retries:1,
 workers:1,
 reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:4173',browserName:'chromium',headless:true},
 webServer:{
   command:'npm run dev -- --host 127.0.0.1 --port 4173',
   url:'http://127.0.0.1:4173',timeout:30000,reuseExistingServer:!process.env.CI,
   env:{VITE_SUPABASE_URL:'https://hydra-e2e.supabase.co',
     VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_hydra_e2e_no_secret_value_123456'}
 }
});
