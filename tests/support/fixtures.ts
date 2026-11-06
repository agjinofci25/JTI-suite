import { test as base, expect } from '@playwright/test';
import { CampaignPage } from '../pages/CampaignPage';
import { ContactPage } from '../pages/ContactPage';
import { env } from './env';

type Fixtures = {
  campaign: CampaignPage;
  contact: ContactPage;
  /** Auto fixture: fails the test on any uncaught JS error from the site. */
  noPageErrors: void;
  /** Auto fixture: fails the test if anything navigates to the production host. */
  stayOnStaging: void;
};

export const test = base.extend<Fixtures>({
  campaign: async ({ page }, use) => {
    await use(new CampaignPage(page));
  },

  contact: async ({ page }, use) => {
    await use(new ContactPage(page));
  },

  noPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await use();
      expect(errors, 'Uncaught JavaScript errors on the page').toEqual([]);
    },
    { auto: true },
  ],

  stayOnStaging: [
    async ({ page }, use) => {
      const hits: string[] = [];
      page.on('request', (req) => {
        if (new URL(req.url()).hostname.endsWith(env.prodHost)) hits.push(req.url());
      });
      await use();
      expect(hits, `Requests went to production (${env.prodHost})`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
