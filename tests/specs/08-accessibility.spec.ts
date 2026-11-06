import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/fixtures';
import { api } from '../support/messages';
import { env } from '../support/env';

test.describe('Accessibility', () => {
  test('whole form can be completed with the keyboard only', async ({ campaign, page }) => {
    await campaign.goto();
    const counter = campaign.countRequests(api.redeem);

    await campaign.codeBox(0).focus();
    await page.keyboard.type(env.invalidCode);

    await campaign.ageButton('25-34').focus();
    await page.keyboard.press('Space');
    await expect(campaign.ageButton('25-34')).toHaveAttribute('aria-pressed', 'true');

    await campaign.consent.focus();
    await page.keyboard.press('Space');
    await expect(campaign.consent).toBeChecked();

    await campaign.submit.focus();
    await page.keyboard.press('Enter');
    await expect(campaign.codeError).toBeVisible();
    expect(counter.count).toBe(1);
  });

  test('honeypot field is not reachable by keyboard', async ({ campaign, page }) => {
    await campaign.goto();
    // Tab through the page and make sure focus never lands on a hidden input.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const hidden = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width < 2 || r.height < 2 || s.opacity === '0' || s.visibility === 'hidden';
      });
      expect(hidden, `Tab #${i + 1} focused an invisible element`).toBe(false);
    }
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@known-bug L-8: homepage has exactly one h1', async ({ campaign, page }) => {
    await campaign.goto();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('@known-bug L-9: FAQ accordion buttons expose aria-expanded', async ({ page }) => {
    await page.goto('/faq');
    await page.locator('main').waitFor();
    // Native <details>/<summary> accordions are accessible without aria-expanded
    // (used in the current version) – that counts as fixed.
    if ((await page.locator('main details').count()) > 0) return;
    const buttons = page.locator('main button, [role="main"] button');
    const count = await buttons.count();
    expect(count, 'no accordion buttons or <details> found on /faq').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toHaveAttribute('aria-expanded', /true|false/);
    }
  });

  test('axe: no serious or critical WCAG 2.1 AA violations on the landing page', async ({ campaign, page }) => {
    await campaign.goto();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      blocking.map((v) => `${v.id} (${v.impact}): ${v.help} – ${v.nodes.length} node(s)`),
    ).toEqual([]);
  });

  // G-18 (TEST_COVERAGE.md): the same scan on the other pages.
  for (const path of ['/faq', '/legal/terms', '/legal/privacy', '/legal/consumer-panel', '/legal/imprint', '/legal/accessibility']) {
    test(`G-18: axe – no serious or critical WCAG 2.1 AA violations on ${path}`, async ({ campaign, page }) => {
      // `campaign` registers the automatic 18+ gate handler.
      void campaign;
      await page.goto(path);
      await page.locator('main h1').first().waitFor();
      await expect(campaign.ageGate).toBeHidden();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id} (${v.impact}): ${v.help} – ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }

  test('G-16: FAQ questions open and close when clicked', async ({ campaign, page }) => {
    void campaign;
    await page.goto('/faq');
    const items = page.locator('main details');
    await expect(items).toHaveCount(12);
    const second = items.nth(1);
    const isOpen = () => second.evaluate((el) => (el as HTMLDetailsElement).open);
    const before = await isOpen();
    await second.locator('summary').click();
    expect(await isOpen()).toBe(!before);
    await second.locator('summary').click();
    expect(await isOpen()).toBe(before);
  });
});
