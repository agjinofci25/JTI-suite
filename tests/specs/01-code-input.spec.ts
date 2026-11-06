import { test, expect } from '../support/fixtures';

test.describe('Step 1 – code input (6 boxes)', () => {
  test.beforeEach(async ({ campaign }) => {
    await campaign.goto();
  });

  test('auto-advances between boxes and converts lowercase to uppercase', async ({ campaign }) => {
    await campaign.typeCode('ab1c2d');
    expect(await campaign.codeValues()).toEqual(['A', 'B', '1', 'C', '2', 'D']);
  });

  test('Backspace on an empty box jumps back and deletes, down to box 1', async ({ campaign, page }) => {
    await campaign.typeCode('ABC');
    // focus is now on box 4 (empty)
    await page.keyboard.press('Backspace');
    expect(await campaign.codeValues()).toEqual(['A', 'B', '', '', '', '']);
    expect(await campaign.focusedBoxIndex()).toBe(2);
    // Keep going back to box 1 (former bug M-3: box 1 used to get stuck), then retype.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    expect(await campaign.codeValues()).toEqual(['', '', '', '', '', '']);
    await page.keyboard.type('X');
    expect((await campaign.codeValues())[0]).toBe('X');
  });

  test('pasting a full code fills all 6 boxes', async ({ campaign }) => {
    await campaign.pasteIntoBox(0, 'abc123');
    expect(await campaign.codeValues()).toEqual(['A', 'B', 'C', '1', '2', '3']);
  });

  test('pasting a code with spaces and hyphens is cleaned up', async ({ campaign }) => {
    await campaign.pasteIntoBox(0, ' abc-123 ');
    expect(await campaign.codeValues()).toEqual(['A', 'B', 'C', '1', '2', '3']);
  });

  test('special characters, spaces, umlauts and emoji are blocked', async ({ campaign, page }) => {
    await campaign.codeBox(0).click();
    for (const ch of ['-', '#', ' ', 'ä']) await page.keyboard.type(ch);
    await page.keyboard.insertText('😀');
    expect(await campaign.codeValues()).toEqual(['', '', '', '', '', '']);
  });

  // Former bug L-2, fixed and verified 5 Nov 2026.
  test('L-2: after a partial paste the cursor moves to the next empty box and typing continues', async ({
    campaign,
    page,
  }) => {
    await campaign.pasteIntoBox(0, 'XQ');
    expect(await campaign.focusedBoxIndex()).toBe(2);
    await page.keyboard.type('Z12A', { delay: 40 });
    expect(await campaign.codeValues()).toEqual(['X', 'Q', 'Z', '1', '2', 'A']);
  });

  // Skipped on request (5 Nov 2026) – not to be raised for now. Change test.skip back to test to re-enable.
  test.skip('@known-bug @mobile M-4: text inserted in one input event (OTP autofill) spreads across boxes', async ({
    campaign,
    page,
  }) => {
    await campaign.codeBox(0).focus();
    await page.keyboard.insertText('ab1');
    expect((await campaign.codeValues()).slice(0, 3)).toEqual(['A', 'B', '1']);
  });

  // Phone bugs found by hand on a real phone (5 Nov 2026) – BUG-1 / BUG-3 in the bug report.
  // On a phone the cursor lands where the finger touches, often in front of the letter;
  // the tests put it there directly, because emulated taps always land behind it.
  // That makes the result the same at every screen size, so they run on desktop only.
  test('@known-bug BUG-1: a letter can be corrected when the cursor is in front of it', async ({
    campaign,
    page,
  }) => {
    await campaign.typeCode('ABCDEF');
    await campaign.codeBox(3).click();
    await campaign.codeBox(3).evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
    await page.keyboard.press('Backspace');
    await page.keyboard.type('X');
    // Today nothing happens: Backspace does not delete "D" and the X is ignored.
    expect((await campaign.codeValues())[3]).toBe('X');
  });

  test('@known-bug BUG-3: deleting the code from box 3 backwards leaves no characters behind', async ({
    campaign,
    page,
  }) => {
    await campaign.typeCode('ABCDEF');
    await campaign.codeBox(2).selectText();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
    // Today: "_ _ _ D E F" – D, E and F stay. The exact expected behaviour is still to be
    // agreed with design; this test assumes the leftover characters are cleared too.
    expect(await campaign.codeValues()).toEqual(['', '', '', '', '', '']);
  });

  test('FAQ link opens the FAQ page', async ({ campaign, page }) => {
    await campaign.faqLink.click();
    await expect(page).toHaveURL(/faq/i);
  });
});
