import { test, expect } from '../support/fixtures';
import { api, deDate, msg } from '../support/messages';
import { mockCampaignState } from '../support/mocks';

/**
 * Coverage gaps G-1, G-3 and G-4 from TEST_COVERAGE.md.
 * Nothing here redeems a code; campaign states are faked with page.route.
 */
test.describe('Age gate', () => {
  test('G-1: "Nein, ich bin unter 18" blocks access, also after a reload', async ({ page }) => {
    // Uses `page`, not the `campaign` fixture: that one clicks "Ja, ich bin 18+" automatically.
    await page.goto('/');
    await page.getByRole('button', { name: /Nein, ich bin unter 18/ }).click();

    await expect(page.getByText(msg.underageTitle)).toBeVisible();
    await expect(page.getByText(msg.underageText)).toBeVisible();
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);

    // The block is remembered (open question to the developers: intended?).
    await page.reload();
    await expect(page.getByText(msg.underageTitle)).toBeVisible();
    await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);
  });
});

test.describe('Campaign status', () => {
  test('G-3: an ended campaign shows the end screen with the campaign period and no code form', async ({
    campaign,
    page,
    request,
  }) => {
    const status = await (await request.get(api.campaignStatus)).json();
    await mockCampaignState(page, 'ended');
    await page.goto('/');

    await expect(page.getByText(msg.campaignEnded)).toBeVisible();
    await expect(page.getByText(`${deDate(status.starts_at)} bis ${deDate(status.ends_at)}`)).toBeVisible();
    await expect(campaign.codeBoxes).toHaveCount(0);
  });

  test('G-4: a campaign that has not started shows the start date and no code form', async ({ campaign, page }) => {
    await mockCampaignState(page, 'coming-soon');
    await page.goto('/');

    await expect(page.getByText(msg.campaignComingSoon)).toBeVisible();
    await expect(page.getByText(/beginnt am/i)).toBeVisible();
    await expect(campaign.codeBoxes).toHaveCount(0);
  });

  // Will fail after the campaign ends (15.12.2026) – then switch the suite to a new campaign.
  test('the real campaign is active and shows the code form', async ({ campaign, request }) => {
    const status = await (await request.get(api.campaignStatus)).json();
    expect(status.state).toBe('active');
    await campaign.goto();
    await expect(campaign.codeBoxes).toHaveCount(6);
  });
});
