import { test, expect } from '../support/fixtures';
import { env } from '../support/env';
import { footerLinks } from '../support/messages';

test.describe('Links and content', () => {
  test.beforeEach(async ({ campaign }) => {
    await campaign.goto();
  });

  for (const name of footerLinks) {
    test(`footer link "${name}" works and stays on staging`, async ({ page, request }) => {
      const link = page.locator('footer').getByRole('link', { name, exact: true });
      const href = await link.getAttribute('href');
      expect(href, `footer link "${name}" has no href`).toBeTruthy();

      const url = new URL(href!, env.baseURL);
      expect(url.hostname.endsWith(env.prodHost), `"${name}" points to production`).toBe(false);

      const res = await request.get(url.toString());
      expect(res.status(), `"${name}" → ${url}`).toBeLessThan(400);
    });
  }

  test('inline links (Teilnahmebedingungen, Datenschutz "hier") resolve', async ({ page, request }) => {
    const links = [
      page.getByRole('link', { name: 'Teilnahmebedingungen' }).first(),
      page.getByRole('link', { name: 'hier', exact: true }),
    ];
    for (const link of links) {
      const href = await link.getAttribute('href');
      const res = await request.get(new URL(href!, env.baseURL).toString());
      expect(res.status(), href!).toBeLessThan(400);
    }
  });

  test('landing page shows the prizes', async ({ page }) => {
    // .first(): the prize footnote at the bottom also contains "Reise nach London".
    await expect(page.getByText('Reise nach London').first()).toBeVisible();
    await expect(page.getByText('Cineplexx Kinogutschein')).toBeVisible();
    await expect(page.getByText('Amazon Gutschein')).toBeVisible();
  });

  test('prize values are shown under the prizes', async ({ page }) => {
    // Replaces the old "*" footnote (older version only); the current version shows the values inline.
    await expect(page.getByText(/im Wert von € 2\.000,00/)).toBeVisible();
    await expect(page.getByText(/im Wert von € 50,00/)).toHaveCount(2);
  });

  test('no placeholder text on the landing page', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/lorem ipsum|TODO|undefined|NaN|\{\{/i);
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@known-bug L-11: no "Dienstleitungen" typo on the accessibility statement', async ({ page }) => {
    await page.goto('/legal/accessibility');
    await expect(page.getByText(/Dienstleitungen/)).toHaveCount(0);
  });

  test('@known-bug L-17: "E-Mail-Adresse" is spelled with both hyphens', async ({ page }) => {
    await expect(page.getByText(/E-Mail Adresse/)).toHaveCount(0);
  });
});
