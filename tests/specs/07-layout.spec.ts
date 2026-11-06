import { test, expect } from '../support/fixtures';
import { ageGroups } from '../support/messages';

/** Runs on desktop (1440), tablet (768) and mobile (375) – see playwright.config.ts. */
test.describe('Layout @layout', () => {
  test.beforeEach(async ({ campaign }) => {
    await campaign.goto();
  });

  test('@layout no horizontal overflow', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('@layout all 6 code boxes are on one row and fully visible', async ({ campaign, page }) => {
    const viewport = page.viewportSize()!;
    const boxes = await campaign.codeBoxes.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), left: r.left, right: r.right };
      }),
    );
    expect(new Set(boxes.map((b) => b.top)).size, 'code boxes wrap onto several rows').toBe(1);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(viewport.width);
    }
  });

  test('@layout code boxes are large enough to tap (≥ 44 px)', async ({ campaign }) => {
    const box = await campaign.codeBox(0).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(36);
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@layout @known-bug L-3: age buttons are at least 44 px tall', async ({ campaign }) => {
    for (const group of ageGroups) {
      const box = await campaign.ageButton(group).boundingBox();
      expect(box!.height, `age button ${group}`).toBeGreaterThanOrEqual(44);
    }
  });

  // No test for the terms text size (old L-4): 10–11 px is a design choice (confirmed 5 Nov 2026).

  test('@layout submit button is fully visible and not overlapped', async ({ campaign }) => {
    await campaign.submit.scrollIntoViewIfNeeded();
    await expect(campaign.submit).toBeInViewport({ ratio: 0.98 }); // Safari rounds the button edge by about half a pixel
  });

  test('@layout visual snapshot of the landing page', async ({ campaign, page }) => {
    // Make sure a late 18+ gate is not part of the screenshot.
    await expect(campaign.ageGate).toBeHidden();
    // No baseline yet: the first run writes it and FAILS; later runs compare against it.
    // Create/update baselines with: npx playwright test 07-layout --update-snapshots
    await expect(page).toHaveScreenshot('landing.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
  });
});
