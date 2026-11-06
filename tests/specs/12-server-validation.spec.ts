import { test, expect } from '../support/fixtures';
import { birthDateForAge, birthDateYearsAgo } from '../pages/ContactPage';
import { env } from '../support/env';
import { api, msg } from '../support/messages';

/**
 * Server-side checks: data sent straight to the API, skipping the form.
 *
 * Safe by design: every request uses the always-invalid code ZZZZZZ. The server
 * validates the fields BEFORE it looks at the code (checked 5 Nov 2026), so:
 *   - a bad field  → 422 with { errors: { <field>: [...] } }
 *   - good fields  → 422 { error: "invalid-code" }  (nothing is stored, no email)
 * Runs once (desktop project only) – there is no browser involved.
 */

const validContact = {
  code: env.invalidCode,
  gender: 'male',
  first_name: 'Test',
  last_name: 'Automation',
  date_of_birth: birthDateForAge(28),
  postal_code: '1030',
  email: env.testEmail,
  accepts_panel: false,
};

const validRedeem = { code: env.invalidCode, age_range: '25-34', accepts_rules: true, website: '' };

test.describe('Server validation – contact endpoint', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API tests run once, in the desktop project');
  });

  test('baseline: valid fields pass the field checks and stop at the unknown code', async ({ request }) => {
    const res = await request.post(api.contact, { data: validContact });
    expect(res.status()).toBe(422);
    expect(await res.json()).toEqual({ error: 'invalid-code' });
  });

  test('a person who turns 18 today passes the age check', async ({ request }) => {
    const res = await request.post(api.contact, { data: { ...validContact, date_of_birth: birthDateYearsAgo(18) } });
    expect(await res.json()).toEqual({ error: 'invalid-code' });
  });

  const rejected: [string, Record<string, unknown>, string][] = [
    ['under 18', { date_of_birth: birthDateForAge(16) }, 'date_of_birth'],
    ['turns 18 tomorrow', { date_of_birth: birthDateYearsAgo(18, 1) }, 'date_of_birth'],
    ['birth date in the future', { date_of_birth: birthDateYearsAgo(-2) }, 'date_of_birth'],
    ['impossible date 31.02.1995', { date_of_birth: '31.02.1995' }, 'date_of_birth'],
    ['date in another format (1998-03-15)', { date_of_birth: '1998-03-15' }, 'date_of_birth'],
    ['postcode with 5 digits', { postal_code: '10115' }, 'postal_code'],
    ['postcode with letters', { postal_code: 'ABCD' }, 'postal_code'],
    ['email without domain (test@)', { email: 'test@' }, 'email'],
    ['first name of only spaces', { first_name: '   ' }, 'first_name'],
    ['first name longer than 120 characters', { first_name: 'A'.repeat(121) }, 'first_name'],
    ['unknown gender value', { gender: 'other' }, 'gender'],
    ['panel consent that is not true/false', { accepts_panel: 'yes' }, 'accepts_panel'],
  ];
  for (const [name, change, field] of rejected) {
    test(`rejects ${name}`, async ({ request }) => {
      const res = await request.post(api.contact, { data: { ...validContact, ...change } });
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.errors?.[field], `expected an error on "${field}", got ${JSON.stringify(body)}`).toBeTruthy();
    });
  }

  test('rejects an empty request and lists every required field', async ({ request }) => {
    const res = await request.post(api.contact, { data: {} });
    expect(res.status()).toBe(422);
    const { errors } = await res.json();
    for (const field of ['code', 'gender', 'first_name', 'last_name', 'date_of_birth', 'postal_code', 'email']) {
      expect(errors[field], `"${field}" should be required`).toBeTruthy();
    }
  });
});

test.describe('Server validation – redeem, verify and resend endpoints', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API tests run once, in the desktop project');
  });

  const rejected: [string, Record<string, unknown>, string][] = [
    ['terms not accepted', { accepts_rules: false }, 'accepts_rules'],
    ['an age range that does not exist', { age_range: '12-17' }, 'age_range'],
    ['a filled honeypot field (bot)', { website: 'http://spam.example' }, 'website'],
  ];
  for (const [name, change, field] of rejected) {
    test(`redeem rejects ${name}`, async ({ request }) => {
      const res = await request.post(api.redeem, { data: { ...validRedeem, ...change } });
      expect(res.status()).toBe(422);
      expect((await res.json()).errors?.[field]).toBeTruthy();
    });
  }

  test('redeem rejects an empty request', async ({ request }) => {
    const res = await request.post(api.redeem, { data: {} });
    expect(res.status()).toBe(422);
    const { errors } = await res.json();
    for (const field of ['code', 'age_range', 'accepts_rules']) expect(errors[field]).toBeTruthy();
  });

  test('redeem with valid fields and an unknown code answers "invalid-code"', async ({ request }) => {
    const res = await request.post(api.redeem, { data: validRedeem });
    expect(res.status()).toBe(422);
  });

  test('verify-email rejects an invalid token with 422 (former L-15)', async ({ request }) => {
    const res = await request.post(api.verifyEmail, { data: { token: 'x'.repeat(40) } });
    expect(res.status()).toBe(422);
  });

  test('resend rejects an unknown code', async ({ request }) => {
    const res = await request.post(`${api.verifyEmail}/resend`, { data: { code: env.invalidCode } });
    expect(res.status()).toBe(422);
    expect(await res.json()).toEqual({ error: 'invalid-code' });
  });
});

/**
 * Bug found 5 Nov 2026: the form lets a first name of any length through, the server
 * allows at most 120 characters, and the user then sees "Verbindung fehlgeschlagen"
 * (a connection error) instead of a message about the name. Retrying can never work.
 * The server answer is faked with the real server's exact 422 body, so nothing is sent.
 */
test.describe('Form vs. server limits', () => {
  test.skip(!env.codeResumableNoWin, 'CODE_RESUMABLE_NO_WIN not set in .env');

  test('@known-bug S-1: a first name over 120 characters gets a field message, not "Verbindung fehlgeschlagen"', async ({
    campaign,
    contact,
    page,
  }) => {
    await page.route(`**${api.contact}`, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'The first name field must not be greater than 120 characters.',
          errors: { first_name: ['The first name field must not be greater than 120 characters.'] },
        }),
      }),
    );
    await campaign.goto();
    const res = await campaign.redeem(env.codeResumableNoWin!, '25-34');
    expect(res.ok(), `redeem returned ${res.status()} – has the 24 h resume window expired?`).toBeTruthy();
    await contact.waitUntilVisible();
    await contact.fillValid({
      firstName: 'A'.repeat(150),
      lastName: env.testLastName,
      email: env.testEmail,
      plz: env.testPlz,
      birthDate: birthDateForAge(28),
    });
    await contact.submit.click();
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('alert').filter({ hasText: msg.network })).toHaveCount(0);
  });
});
