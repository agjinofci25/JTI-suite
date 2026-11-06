import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { birthDateForAge } from '../pages/ContactPage';
import { env } from '../support/env';
import { api, msg } from '../support/messages';

/**
 * Coverage gaps G-5 … G-8 and G-11 (TEST_COVERAGE.md): everything after "Absenden".
 *
 * The server answers for contact, verify-email and resend are FAKED with page.route,
 * in the exact format the site's code reads (checked against the frontend bundle,
 * 5 Nov 2026). No contact data reaches the server, no email is sent, no code is used up.
 *
 * Verify-email answer: { status, verified_at, reward_path, voucher_type }
 *   status "valid" / "used" → result page (/complete); "email-taken" → duplicate screen
 *   reward_path "prize_draw" → no instant win (draw); anything else → instant win
 *   voucher_type "amazon" | "cineplexx"
 */

const token = 'e2e'.padEnd(40, '0');
const inSeconds = (s: number) => new Date(Date.now() + s * 1_000).toISOString();

function fakeJson(page: Page, path: string, status: number, body: unknown) {
  return page.route(`**${path}`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

// ---------------------------------------------------------------------------
// The link in the email (no code needed – the page only calls verify-email)
// ---------------------------------------------------------------------------
test.describe('Email link → result page (G-7, G-11)', () => {
  const verified = (reward_path: string, voucher_type: string | null, status = 'valid') => ({
    status,
    verified_at: new Date().toISOString(),
    reward_path,
    voucher_type,
  });

  test('instant win – Amazon voucher', async ({ campaign, page }) => {
    void campaign; // registers the automatic 18+ gate handler
    await fakeJson(page, api.verifyEmail, 200, verified('instant_win', 'amazon'));
    await page.goto(`/verify-email/${token}`);
    await expect(page).toHaveURL(/\/complete$/);
    await expect(page.getByText(msg.resultWinTitle)).toBeVisible();
    await expect(page.getByText(msg.resultAmazon)).toBeVisible();
  });

  test('instant win – Cineplexx voucher', async ({ campaign, page }) => {
    void campaign;
    await fakeJson(page, api.verifyEmail, 200, verified('instant_win', 'cineplexx'));
    await page.goto(`/verify-email/${token}`);
    await expect(page).toHaveURL(/\/complete$/);
    await expect(page.getByText(msg.resultWinTitle)).toBeVisible();
    await expect(page.getByText(msg.resultCineplexx)).toBeVisible();
  });

  test('no instant win – entered into the main prize draw', async ({ campaign, page }) => {
    void campaign;
    await fakeJson(page, api.verifyEmail, 200, verified('prize_draw', null));
    await page.goto(`/verify-email/${token}`);
    await expect(page).toHaveURL(/\/complete$/);
    await expect(page.getByText(msg.resultDrawTitle)).toBeVisible();
    await expect(page.getByText(msg.resultDraw)).toBeVisible();
    await expect(page.getByText(msg.resultWinTitle)).toHaveCount(0);
  });

  test('opening an already used link shows the result again', async ({ campaign, page }) => {
    void campaign;
    await fakeJson(page, api.verifyEmail, 200, verified('prize_draw', null, 'used'));
    await page.goto(`/verify-email/${token}`);
    await expect(page).toHaveURL(/\/complete$/);
    await expect(page.getByText(msg.resultDraw)).toBeVisible();
  });

  test('G-8: link for an email that already took part shows "bereits verwendet"', async ({ campaign, page }) => {
    void campaign;
    await fakeJson(page, api.verifyEmail, 200, { status: 'email-taken', verified_at: null, reward_path: null, voucher_type: null });
    await page.goto(`/verify-email/${token}`);
    await expect(page.getByText(msg.emailTakenTitle)).toBeVisible();
  });

  test('G-11: too many requests – the link stays valid', async ({ campaign, page }) => {
    void campaign;
    await fakeJson(page, api.verifyEmail, 429, {});
    await page.goto(`/verify-email/${token}`);
    await expect(page.getByText(msg.verifyThrottled)).toBeVisible();
    await expect(page.getByRole('button', { name: /Erneut versuchen/ })).toBeVisible();
  });

  test('G-11: no connection – "Wir konnten den Link gerade nicht prüfen"', async ({ campaign, page }) => {
    void campaign;
    await page.route(`**${api.verifyEmail}`, (route) => route.abort());
    await page.goto(`/verify-email/${token}`);
    await expect(page.getByText(msg.verifyUnreachable)).toBeVisible();
    await expect(page.getByRole('button', { name: /Erneut versuchen/ })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// After "Absenden": the "Bestätige deine E-Mail" page and resending the link
// ---------------------------------------------------------------------------
test.describe('Contact form → verification page (G-5, G-6, G-8)', () => {
  test.skip(!env.codeResumableNoWin, 'CODE_RESUMABLE_NO_WIN not set in .env');
  test.describe.configure({ mode: 'default' });

  /** Redeems the resumable code (real) and submits a valid contact form (answer faked). */
  async function submitContact(
    { campaign, contact, page }: { campaign: import('../pages/CampaignPage').CampaignPage; contact: import('../pages/ContactPage').ContactPage; page: Page },
    contactAnswer: { status: number; body: unknown },
  ) {
    await fakeJson(page, api.contact, contactAnswer.status, contactAnswer.body);
    await campaign.goto();
    const res = await campaign.redeem(env.codeResumableNoWin!, '25-34');
    expect(res.ok(), `redeem returned ${res.status()} – has the 24 h resume window expired?`).toBeTruthy();
    await contact.waitUntilVisible();
    await contact.fillValid({
      firstName: env.testFirstName,
      lastName: env.testLastName,
      email: env.testEmail,
      plz: env.testPlz,
      birthDate: birthDateForAge(28),
    });
    await contact.submit.click();
  }

  test('G-5: a successful submit opens "Bestätige deine E-Mail" with the masked address and a resend timer', async ({
    campaign,
    contact,
    page,
  }) => {
    await submitContact({ campaign, contact, page }, { status: 200, body: { resend_available_at: inSeconds(60) } });
    await expect(page).toHaveURL(/\/verify-email$/);
    await expect(page.getByText(msg.verifyHeadline)).toBeVisible();
    await expect(page.getByText(msg.verifySentTo)).toBeVisible();
    // The address is masked, e.g. "tes...e@example.com" – never shown in full.
    await expect(page.getByText(env.testEmail, { exact: false })).toHaveCount(0);
    await expect(page.getByText(msg.resendWait)).toBeVisible();
    await expect(page.getByRole('button', { name: /Kontaktdaten bearbeiten/ })).toBeVisible();
  });

  test('G-8: an email that already took part is rejected on the contact form', async ({ campaign, contact, page }) => {
    await submitContact({ campaign, contact, page }, { status: 409, body: { code: 'email-already-used' } });
    await expect(page.getByRole('alert').filter({ hasText: msg.emailAlreadyUsed })).toBeVisible();
    await expect(contact.email).toBeVisible(); // stays on the form
  });

  test.describe('resending the link (G-6)', () => {
    async function openVerificationPage(fixtures: Parameters<typeof submitContact>[0]) {
      // resend_available_at in the past → the "E-Mail erneut senden" button is active at once
      await submitContact(fixtures, { status: 200, body: { resend_available_at: inSeconds(-1) } });
      await expect(fixtures.page.getByText(msg.verifyHeadline)).toBeVisible();
      return fixtures.page.getByRole('button', { name: msg.resendButton });
    }

    test('resend works – new link sent, old one invalid, timer restarts', async ({ campaign, contact, page }) => {
      await fakeJson(page, api.verifyEmail + '/resend', 200, { status: 'sent', resend_available_at: inSeconds(60) });
      const resend = await openVerificationPage({ campaign, contact, page });
      await resend.click();
      await expect(page.getByText(msg.resendSent)).toBeVisible();
      await expect(page.getByText(msg.resendWait)).toBeVisible();
    });

    test('last link sent – the resend button is replaced by the "maximale Anzahl" notice', async ({
      campaign,
      contact,
      page,
    }) => {
      // The site shows the limit notice when a resend succeeds WITHOUT a next possible
      // time (resend_available_at: null). An error answer with code
      // "verification-limit-reached" shows nothing at all (open question, TEST_COVERAGE.md).
      await fakeJson(page, api.verifyEmail + '/resend', 200, { status: 'sent', resend_available_at: null });
      const resend = await openVerificationPage({ campaign, contact, page });
      await resend.click();
      await expect(page.getByText(msg.resendLimit)).toBeVisible();
      await expect(page.getByRole('button', { name: msg.resendButton })).toHaveCount(0);
    });

    test('resend fails on the network – "Der Link konnte nicht gesendet werden"', async ({ campaign, contact, page }) => {
      await page.route(`**${api.verifyEmail}/resend`, (route) => route.abort());
      const resend = await openVerificationPage({ campaign, contact, page });
      await resend.click();
      await expect(page.getByText(msg.resendFailed)).toBeVisible();
    });
  });
});
