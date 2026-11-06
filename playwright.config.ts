import { defineConfig, devices } from '@playwright/test';
import { env, assertStaging } from './tests/support/env';

assertStaging(env.baseURL);

export default defineConfig({
  testDir: './tests/specs',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: env.baseURL,
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // The three widths from the manual QA run (1440 / 768 / 375).
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
      // Behaviour tests are viewport-independent; run only layout checks here.
      grep: /@layout/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
      grep: /@layout|@mobile/,
    },
  ],
});
