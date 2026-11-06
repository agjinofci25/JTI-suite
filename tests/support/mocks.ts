import type { Page } from '@playwright/test';
import { api, type CampaignState } from './messages';

/**
 * Lets the real GET /api/campaign/status answer through, but replaces its `state`
 * field. Start and end dates stay real, so date texts can be checked.
 */
export async function mockCampaignState(page: Page, state: CampaignState): Promise<void> {
  await page.route(`**${api.campaignStatus}*`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, state } });
  });
}
