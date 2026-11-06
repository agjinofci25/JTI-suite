import { test, expect } from '../support/fixtures';
import { birthDateForAge, birthDateYearsAgo, type ContactData, type ContactPage } from '../pages/ContactPage';
import type { CampaignPage } from '../pages/CampaignPage';
import { env } from '../support/env';
import { api, msg } from '../support/messages';

/**
 * These tests redeem CODE_RESUMABLE_NO_WIN, an unfinished no-win entry.
 * Re-entering it resumes the entry, so the code is NOT used up as long as
 * the contact form is never submitted with fully valid data.
 * A route block in beforeEach aborts every contact request, so even the
 * "accepted" edge-case tests (E-…) never reach the server: they only check that
 * the browser TRIED to send the form.
 */
test.describe('Step 4 – contact form validation (resumable code)', () => {
  test.skip(!env.codeResumableNoWin, 'CODE_RESUMABLE_NO_WIN not set in .env');
  // Every test redeems the same code, so run them one after another in a single
  // worker instead of in parallel. 'default' (not 'serial') so a failing
  // @known-bug test does not skip the rest.
  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ campaign, contact, page }) => {
    // Safety net: never let a contact submit reach the server, so the resumable code
    // cannot be used up even if a test or the site's validation changes.
    // Request counters still see the (aborted) request.
    await page.route(`**${api.contact}*`, (route) => route.abort());
    await campaign.goto();
    const res = await campaign.redeem(env.codeResumableNoWin!, '25-34');
    expect(res.ok(), `redeem returned ${res.status()} – has the 24 h resume window expired?`).toBeTruthy();
    await contact.waitUntilVisible();
  });

  test('contact form comes first; the result is not revealed before email verification', async ({ page }) => {
    await expect(page.getByText(msg.contactIntro)).toBeVisible();
    await expect(page.getByText(msg.resultNoWinHeadline)).toHaveCount(0);
    await expect(page.getByText(msg.resultWinHeadline)).toHaveCount(0);
  });

  test('empty submit shows an error on every field and sends nothing', async ({ campaign, contact, page }) => {
    const counter = campaign.countRequests(api.contact);
    await contact.submit.click();
    await expect(page.getByText(msg.genderMissing)).toBeVisible(); // G-12: gender is required
    await expect(page.getByText(msg.birthDateMissing)).toBeVisible();
    expect(counter.count).toBe(0);
  });

  test('G-2: a birth date under 18 is rejected with the "ab 18 Jahren" message', async ({ campaign, contact, page }) => {
    const counter = campaign.countRequests(api.contact);
    // Every other field valid, so only the age can block the submit (route block in beforeEach as backup).
    await contact.fillValid({
      firstName: env.testFirstName,
      lastName: env.testLastName,
      email: env.testEmail,
      plz: env.testPlz,
      birthDate: birthDateForAge(16),
    });
    await contact.submit.click();
    await expect(page.getByText(msg.birthDateUnder18)).toBeVisible();
    expect(counter.count, 'contact form was sent with an under-18 birth date').toBe(0);
  });

  test('G-13: reloading the page keeps the user on the contact form', async ({ contact, page }) => {
    await page.reload();
    await contact.waitUntilVisible();
    await expect(page.getByText(msg.contactIntro)).toBeVisible();
  });

  for (const bad of ['test@', 'test.com']) {
    test(`invalid email "${bad}" is rejected and the error clears when fixed`, async ({ contact, page }) => {
      await contact.fill({ email: bad });
      await contact.submit.click();
      await expect(page.getByText(msg.emailInvalid)).toBeVisible();
      await contact.email.fill(env.testEmail);
      await contact.email.blur();
      await expect(page.getByText(msg.emailInvalid)).toBeHidden();
    });
  }

  for (const bad of ['10115', '123', 'ABCD', '12a4', '10 30']) {
    test(`postcode "${bad}" is rejected`, async ({ contact, page }) => {
      await contact.fill({ plz: bad });
      await contact.submit.click();
      await expect(page.getByText(msg.plzInvalid)).toBeVisible();
    });
  }

  // No test for non-existent postcodes such as 0000 / 0999: any 4-digit postcode is
  // accepted on purpose (confirmed by the developers, 5 Nov 2026).

  // Former bug L-13, fixed and verified 5 Nov 2026.
  for (const date of ['31.02.1995', '31.04.1990', '29.02.2001']) {
    test(`L-13: impossible date ${date} gets the "not valid" message, not "missing"`, async ({ contact, page }) => {
      await contact.fill({ birthDate: date });
      await contact.submit.click();
      await expect(page.getByText(msg.birthDateInvalid)).toBeVisible();
      await expect(page.getByText(msg.birthDateMissing)).toBeHidden();
    });
  }

  test('L-13: the real leap day 29.02.2000 is not rejected as invalid', async ({ contact, page }) => {
    await contact.fill({ birthDate: '29.02.2000' });
    await contact.submit.click();
    await expect(page.getByText(msg.birthDateInvalid)).toBeHidden();
    await expect(page.getByText(msg.birthDateMissing)).toBeHidden();
  });

  test('consent timestamp is hidden while unticked and appears after ticking the panel checkbox', async ({
    contact,
    page,
  }) => {
    // Former bug H-2: the timestamp used to show while the box was still unticked.
    await expect(contact.panelConsent).not.toBeChecked();
    await expect(page.getByText(msg.consentTimestamp)).toBeHidden();
    await contact.acceptPanelConsent();
    await expect(page.getByText(msg.consentTimestamp)).toBeVisible();
    await contact.panelConsent.uncheck();
  });

  test('@known-bug L-14: instruction text matches the "Absenden" button label', async ({ page }) => {
    await expect(page.getByText(/klicke auf senden/i)).toHaveCount(0);
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@known-bug L-17: contact form spells "E-Mail-Adresse" with both hyphens', async ({ page }) => {
    // The label is the field's accessible name / placeholder, not plain page text.
    await expect(page.getByRole('textbox', { name: /E-Mail Adresse/ })).toHaveCount(0);
    await expect(page.getByText(/E-Mail Adresse/)).toHaveCount(0);
  });

  // No test for "birth date must match the chosen age group": the client asked for that
  // check to be removed (confirmed by the developers, 5 Nov 2026).

  // ---------------------------------------------------------------------------
  // Edge cases E-1 … E-15 (TEST_COVERAGE.md, section 2b)
  // ---------------------------------------------------------------------------

  test.describe('edge cases', () => {
    /** Fills every field validly, applies `overrides`, clicks Absenden. Returns true if the browser tried to send. */
    async function submitWith(
      campaign: CampaignPage,
      contact: ContactPage,
      overrides: Partial<ContactData>,
    ): Promise<boolean> {
      const counter = campaign.countRequests(api.contact);
      await contact.fillValid({
        firstName: env.testFirstName,
        lastName: env.testLastName,
        email: env.testEmail,
        plz: env.testPlz,
        birthDate: birthDateForAge(28),
        ...overrides,
      });
      await contact.submit.click();
      await contact.page.waitForTimeout(1_000);
      return counter.count > 0;
    }

    test('E-1: someone who turns 18 today is accepted', async ({ campaign, contact }) => {
      expect(await submitWith(campaign, contact, { birthDate: birthDateYearsAgo(18) })).toBe(true);
    });

    test('E-2: someone who turns 18 tomorrow is rejected', async ({ campaign, contact, page }) => {
      expect(await submitWith(campaign, contact, { birthDate: birthDateYearsAgo(18, 1) })).toBe(false);
      await expect(page.getByText(msg.birthDateUnder18)).toBeVisible();
    });

    test('E-3: a birth date in the future is rejected', async ({ campaign, contact, page }) => {
      expect(await submitWith(campaign, contact, { birthDate: birthDateYearsAgo(-1) })).toBe(false);
      await expect(page.getByText(msg.birthDateUnder18)).toBeVisible();
    });

    test('E-4: a birth date typed without dots is formatted as dd.mm.yyyy', async ({ contact }) => {
      await contact.fill({ birthDate: '15031998' });
      await expect(contact.birthDate).toHaveValue('15.03.1998');
    });

    test('E-6: names with umlauts, hyphen and apostrophe are accepted', async ({ campaign, contact }) => {
      expect(await submitWith(campaign, contact, { firstName: 'Jürgen-Öz', lastName: "O'Brien Müller" })).toBe(true);
    });

    test('E-7: names made only of spaces are rejected', async ({ campaign, contact, page }) => {
      expect(await submitWith(campaign, contact, { firstName: '   ', lastName: '   ' })).toBe(false);
      await expect(page.getByText(msg.firstNameMissing)).toBeVisible();
      await expect(page.getByText(msg.lastNameMissing)).toBeVisible();
    });

    for (const email of [env.testEmail.toUpperCase(), `  ${env.testEmail}  `]) {
      test(`E-10: email "${email}" (capitals / spaces around) is accepted`, async ({ campaign, contact }) => {
        expect(await submitWith(campaign, contact, { email })).toBe(true);
      });
    }

    test('E-11: email without a domain ending ("a@b") is rejected', async ({ campaign, contact, page }) => {
      expect(await submitWith(campaign, contact, { email: 'a@b' })).toBe(false);
      await expect(page.getByText(msg.emailInvalid)).toBeVisible();
    });

    // E-12 (postcode with a space / 5 digits) is covered by the postcode loop above.

    for (const [how, close] of [
      ['the ✕ button', (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Dialog schließen' }).click()],
      ['Escape', (page: import('@playwright/test').Page) => page.keyboard.press('Escape')],
    ] as const) {
      test(`E-13: closing the panel dialog with ${how} leaves the checkbox unticked`, async ({ contact, page }) => {
        await contact.panelConsent.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await close(page);
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(contact.panelConsent).not.toBeChecked();
        await expect(page.getByText(msg.consentTimestamp)).toBeHidden();
      });
    }

    test('E-14: the browser back button returns to the start page with the code form', async ({ campaign, page }) => {
      await page.goBack();
      await expect(campaign.codeBoxes).toHaveCount(6);
    });

    test('E-15: the contact form fits a 375 px phone screen', async ({ contact, page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal scrolling on the contact form').toBeLessThanOrEqual(0);
      await contact.submit.scrollIntoViewIfNeeded();
      await expect(contact.submit).toBeInViewport({ ratio: 0.98 }); // Safari rounds the button edge by about half a pixel
    });
  });
});
