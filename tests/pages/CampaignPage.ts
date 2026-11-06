import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { api, msg, type AgeGroup } from '../support/messages';

/**
 * Landing page: age gate, 6 code boxes, age buttons, consent checkbox, submit.
 *
 * Locators use roles and visible text where possible. Anything marked
 * VERIFY is an educated guess from the QA report – check it once against
 * the real DOM (npx playwright codegen <BASE_URL>) and adjust here only.
 */
export class CampaignPage {
  readonly codeBoxes: Locator;
  readonly consent: Locator;
  readonly submit: Locator;
  readonly ageError: Locator;
  readonly codeError: Locator;
  readonly faqLink: Locator;
  /** "Ja, ich bin 18+" button of the age-gate dialog. */
  readonly ageGate: Locator;

  constructor(readonly page: Page) {
    // Confirmed in the report: autocomplete="one-time-code", maxlength=1.
    this.codeBoxes = page.locator('input[autocomplete="one-time-code"]');
    this.consent = page.getByRole('checkbox', { name: /Teilnahmebedingungen/ });
    this.submit = page.getByRole('button', { name: /Ich will gewinnen/ });
    this.ageError = page.getByText(msg.ageError);
    // Confirmed: the invalid-code message has role="alert".
    this.codeError = page.getByRole('alert').filter({ hasText: msg.codeInvalid });
    // The FAQ link appears twice (in the form and in the footer); use the one in <main>.
    this.faqLink = page.getByRole('main').getByRole('link', { name: /Häufige Fragen/ });

    this.ageGate = page.getByRole('button', { name: /Ja, ich bin 18/ });
    // The 18+ gate can appear late (seen on the test environment), after goto() has stopped
    // waiting for it, and then covers the page. Dismiss it whenever it shows up.
    // Tests that check the gate itself must call page.removeLocatorHandler(this.ageGate).
    void page.addLocatorHandler(this.ageGate, async () => {
      await this.ageGate.click();
    });
  }

  codeBox(index: number): Locator {
    return this.codeBoxes.nth(index);
  }

  ageButton(group: AgeGroup): Locator {
    return this.page.getByRole('button', { name: group, exact: true });
  }

  /** Opens the page with a clean browser state and passes the 18+ gate. */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.passAgeGate();
    await expect(this.codeBoxes).toHaveCount(6);
  }

  async passAgeGate(): Promise<void> {
    // Wait briefly for the gate; the locator handler from the constructor clicks it
    // as soon as an assertion or action runs (toBeHidden counts as one).
    const shown = await this.ageGate
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (shown) await expect(this.ageGate).toBeHidden();
  }

  /** Types the code into box 1 and relies on auto-advance. */
  async typeCode(code: string): Promise<void> {
    await this.codeBox(0).click();
    await this.page.keyboard.type(code, { delay: 40 });
  }

  /** Dispatches a real `paste` event with clipboard data on the given box. */
  async pasteIntoBox(index: number, text: string): Promise<void> {
    const box = this.codeBox(index);
    await box.focus();
    await box.evaluate((el, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, text);
  }

  async codeValues(): Promise<string[]> {
    return this.codeBoxes.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  }

  async focusedBoxIndex(): Promise<number> {
    return this.codeBoxes.evaluateAll((els) => els.indexOf(document.activeElement as HTMLElement));
  }

  /**
   * Fills code, age and consent, clicks submit and returns the redeem response.
   * If the request is dropped on the network ("Verbindung fehlgeschlagen" – seen now and
   * then on staging when several browsers run at once), it clicks submit once more.
   * Any real HTTP answer (200, 409, 422, 429 …) is returned as-is, never retried.
   */
  async redeem(code: string, age: AgeGroup = '25-34'): Promise<Response> {
    await this.typeCode(code);
    await this.ageButton(age).click();
    await this.consent.check();
    const isRedeem = (url: string, method: string) => url.includes(api.redeem) && method === 'POST';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = this.page
        .waitForResponse((r) => isRedeem(r.url(), r.request().method()), { timeout: 20_000 })
        .catch(() => null);
      const failed = this.page
        .waitForEvent('requestfailed', { predicate: (r) => isRedeem(r.url(), r.method()), timeout: 20_000 })
        .then(() => null)
        .catch(() => null);
      await this.submit.click();
      const result = await Promise.race([response, failed]);
      if (result) return result;
      await this.page.waitForTimeout(1_000);
    }
    throw new Error(`redeem request for "${code}" failed twice on the network (no HTTP answer)`);
  }

  /** Counts POST requests to an API path from now on. */
  countRequests(path: string): { readonly count: number } {
    const counter = { count: 0 };
    this.page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes(path)) counter.count++;
    });
    return counter;
  }
}
