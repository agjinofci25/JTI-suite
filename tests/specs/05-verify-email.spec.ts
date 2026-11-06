import { test, expect } from '../support/fixtures';
import { msg } from '../support/messages';

const fakeToken = '0'.repeat(32);

test.describe('Step 4 – email verification link', () => {
  test('an invalid verification link shows "Link ungültig" with a way to request a new one', async ({ page }) => {
    await page.goto(`/verify-email/${fakeToken}`);
    await expect(page.getByText(msg.verifyLinkInvalid)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(msg.verifyNewLink)).toBeVisible();
  });

  // Former L-15 (API answers an invalid token with a 4xx) is checked in 12-server-validation.
});
