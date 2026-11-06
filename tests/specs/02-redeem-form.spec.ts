import { test, expect } from '../support/fixtures';
import { api, msg, ageGroups } from '../support/messages';
import { env } from '../support/env';

test.describe('Steps 2–3 – age, consent and submit', () => {
  test.beforeEach(async ({ campaign }) => {
    await campaign.goto();
  });

  // Former bug M-1, fixed and verified 5 Nov 2026.
  test('M-1: age error is hidden on load and appears only after a submit attempt without an age', async ({
    campaign,
  }) => {
    await expect(campaign.ageError).toBeHidden();
    await campaign.typeCode(env.invalidCode);
    await campaign.consent.check();
    await campaign.submit.click({ force: true }); // the button is disabled without an age
    await expect(campaign.ageError).toBeVisible();
  });

  test('only one age group can be selected at a time (aria-pressed)', async ({ campaign }) => {
    for (const group of ageGroups) {
      await campaign.ageButton(group).click();
      for (const other of ageGroups) {
        await expect(campaign.ageButton(other)).toHaveAttribute(
          'aria-pressed',
          other === group ? 'true' : 'false',
        );
      }
    }
  });

  test('age error disappears once an age is chosen', async ({ campaign }) => {
    await campaign.ageButton('35-44').click();
    await expect(campaign.ageError).toBeHidden();
  });

  test('submit is disabled with an incomplete code', async ({ campaign }) => {
    await campaign.typeCode('ABCD');
    await campaign.ageButton('25-34').click();
    await campaign.consent.check();
    await expect(campaign.submit).toBeDisabled();
  });

  test('submit is disabled without the consent checkbox', async ({ campaign }) => {
    await campaign.typeCode(env.invalidCode);
    await campaign.ageButton('25-34').click();
    await expect(campaign.consent).not.toBeChecked();
    await expect(campaign.submit).toBeDisabled();
  });

  // No test for a hint on the disabled submit button (old M-2): showing no reason is a
  // design choice (confirmed 5 Nov 2026).

  test('invalid code: 422 and a clear alert that clears when the code is edited', async ({ campaign, page }) => {
    const res = await campaign.redeem(env.invalidCode);
    expect(res.status()).toBe(422);
    await expect(campaign.codeError).toBeVisible();

    // Overwrite the last character. (A plain click puts the caret in front of it, so
    // Backspace would delete nothing – normal input behaviour, not a bug.)
    await campaign.codeBox(5).selectText();
    await page.keyboard.type('Y');
    await expect(campaign.codeError).toBeHidden();
  });

  test('double-clicking submit sends only one redeem request', async ({ campaign, page }) => {
    const counter = campaign.countRequests(api.redeem);
    await campaign.typeCode(env.invalidCode);
    await campaign.ageButton('25-34').click();
    await campaign.consent.check();
    await campaign.submit.dblclick();
    await expect(campaign.codeError).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(counter.count).toBe(1);
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@known-bug L-10: invalid code marks the inputs as invalid for screen readers', async ({ campaign }) => {
    await campaign.redeem(env.invalidCode);
    await expect(campaign.codeBox(0)).toHaveAttribute('aria-invalid', 'true');
  });

  test('already used code: 409 and "bereits benutzt" message', async ({ campaign, page }) => {
    test.skip(!env.codeUsed, 'CODE_USED not set in .env');
    const res = await campaign.redeem(env.codeUsed!);
    expect(res.status()).toBe(409);
    await expect(page.getByText(msg.codeUsed)).toBeVisible();
  });

  // G-9 / G-10 (TEST_COVERAGE.md): server errors are faked, nothing reaches the backend.
  test('G-9: no connection when redeeming shows a "Verbindung fehlgeschlagen" message', async ({ campaign, page }) => {
    await page.route(`**${api.redeem}*`, (route) => route.abort());
    await campaign.typeCode(env.invalidCode);
    await campaign.ageButton('25-34').click();
    await campaign.consent.check();
    await campaign.submit.click();
    await expect(page.getByRole('alert').filter({ hasText: msg.network })).toBeVisible();
  });

  test('G-10: too many attempts (HTTP 429) shows a "Zu viele Versuche" message', async ({ campaign, page }) => {
    await page.route(`**${api.redeem}*`, (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
    );
    const res = await campaign.redeem(env.invalidCode);
    expect(res.status()).toBe(429);
    await expect(page.getByRole('alert').filter({ hasText: msg.tooManyAttempts })).toBeVisible();
  });
});
