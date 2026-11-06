import { test, expect } from '../support/fixtures';
import { CampaignPage } from '../pages/CampaignPage';
import { birthDateForAge } from '../pages/ContactPage';
import { env } from '../support/env';
import { api, msg } from '../support/messages';

/**
 * End-to-end flows that USE UP a code and send a real verification email.
 * Skipped unless RUN_CONSUMING_TESTS=true. Put fresh codes in .env before
 * every run (CODE_FRESH_WIN / CODE_FRESH_NO_WIN). Email confirmation itself
 * stays manual – the test stops on the "Bestätige deine E-Mail" page.
 */
test.describe('@consumes-code full participation flow', () => {
  test.skip(!env.runConsuming, 'Set RUN_CONSUMING_TESTS=true to run tests that consume codes');
  // No retries: a retry would redeem an already-used code and fail with a misleading 409.
  test.describe.configure({ mode: 'serial', retries: 0 });

  const scenarios = [
    { name: 'instant win', code: () => env.codeFreshWin, expectWin: true },
    { name: 'no win (draw entry)', code: () => env.codeFreshNoWin, expectWin: false },
  ];

  for (const s of scenarios) {
    test(`${s.name}: redeem → contact → verify page → code blocked`, async ({
      campaign,
      contact,
      page,
      browser,
    }) => {
      const code = s.code();
      test.skip(!code, `No fresh code configured for "${s.name}"`);

      await test.step('redeem the code', async () => {
        await campaign.goto();
        const res = await campaign.redeem(code!, '25-34');
        expect(res.ok(), `redeem returned ${res.status()}`).toBeTruthy();
      });

      await test.step('contact form first – result not revealed yet', async () => {
        // In the current version, win/no-win is shown only after email
        // verification, which is not automated. `expectWin` documents the code's type.
        await expect(page.getByText(msg.contactIntro)).toBeVisible();
        await expect(page.getByText(msg.resultWinHeadline)).toHaveCount(0);
        await expect(page.getByText(msg.resultNoWinHeadline)).toHaveCount(0);
      });

      await test.step('contact form – double-click sends one request', async () => {
        await contact.waitUntilVisible();
        await contact.fillValid({
          firstName: env.testFirstName,
          lastName: env.testLastName,
          email: env.testEmail,
          plz: env.testPlz,
          birthDate: birthDateForAge(28),
        });
        const counter = campaign.countRequests(api.contact);
        const [res] = await Promise.all([
          page.waitForResponse((r) => r.url().includes(api.contact) && r.request().method() === 'POST'),
          contact.submit.dblclick(),
        ]);
        expect(res.ok(), `contact returned ${res.status()}`).toBeTruthy();
        await page.waitForTimeout(1_000);
        expect(counter.count).toBe(1);
      });

      await test.step('verify-email page', async () => {
        await expect(page).toHaveURL(/verify-email/);
        await expect(page.getByText(msg.verifyHeadline)).toBeVisible();
      });

      await test.step('@known-bug M-9 (soft): "Kontaktdaten bearbeiten" is pre-filled', async () => {
        const edit = page
          .getByRole('button', { name: /Kontaktdaten bearbeiten/ })
          .or(page.getByRole('link', { name: /Kontaktdaten bearbeiten/ }));
        if (await edit.count()) {
          await edit.first().click();
          await expect.soft(contact.email, 'M-9: edit form should be pre-filled').toHaveValue(env.testEmail);
        }
      });

      await test.step('the same code is blocked in a fresh browser', async () => {
        const ctx = await browser.newContext();
        const again = new CampaignPage(await ctx.newPage());
        await again.goto();
        const res = await again.redeem(code!, '25-34');
        expect(res.status()).toBe(409);
        await expect(again.page.getByText(msg.codeUsed)).toBeVisible();
        await ctx.close();
      });
    });
  }
});
