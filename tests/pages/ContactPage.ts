import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { api } from '../support/messages';

export interface ContactData {
  firstName: string;
  lastName: string;
  email: string;
  plz: string;
  /** dd.mm.yyyy */
  birthDate: string;
}

/**
 * Contact form shown after a successful redeem (win and no-win use the same form).
 *
 * Locators checked against staging on 5 Nov 2026. The fields have accessible
 * names ("Vorname*", "E-Mail Adresse*", …) but no <label> element, so they are
 * found by role + name, not getByLabel. Salutation is three buttons (M / W / Keine Angabe).
 */
export class ContactPage {
  readonly salutationMale: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly plz: Locator;
  readonly birthDate: Locator;
  readonly panelConsent: Locator;
  readonly submit: Locator;

  constructor(readonly page: Page) {
    this.salutationMale = page.getByRole('button', { name: 'M', exact: true });
    this.firstName = page.getByRole('textbox', { name: /Vorname/ });
    this.lastName = page.getByRole('textbox', { name: /Nachname/ });
    this.email = page.getByRole('textbox', { name: /E-Mail/ });
    this.plz = page.getByRole('textbox', { name: /PLZ/ });
    this.birthDate = page.getByRole('textbox', { name: /Geburtsdatum/ });
    this.panelConsent = page.getByRole('checkbox', { name: /Consumer.?Online.?Panel|Panel/ });
    this.submit = page.getByRole('button', { name: /^Absenden$/ });
  }

  async waitUntilVisible(): Promise<void> {
    await this.email.waitFor({ state: 'visible' });
  }

  async fill(data: Partial<ContactData>): Promise<void> {
    if (data.firstName !== undefined) await this.firstName.fill(data.firstName);
    if (data.lastName !== undefined) await this.lastName.fill(data.lastName);
    if (data.email !== undefined) await this.email.fill(data.email);
    if (data.plz !== undefined) await this.plz.fill(data.plz);
    if (data.birthDate !== undefined) {
      // Typed rather than filled, so masked/date inputs receive real key events.
      await this.birthDate.click();
      await this.birthDate.pressSequentially(data.birthDate, { delay: 30 });
    }
  }

  /**
   * Ticks the Consumer-Online-Panel checkbox. In the current version this
   * opens an info dialog that must be confirmed with "Ich akzeptiere".
   */
  async acceptPanelConsent(): Promise<void> {
    await this.panelConsent.click();
    const accept = this.page.getByRole('dialog').getByRole('button', { name: /Ich akzeptiere/ });
    if (await accept.isVisible({ timeout: 3_000 }).catch(() => false)) await accept.click();
    await expect(this.panelConsent).toBeChecked();
  }

  async fillValid(data: ContactData): Promise<void> {
    await this.salutationMale.click();
    await this.fill(data);
  }

  async submitAndWait(): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().includes(api.contact) && r.request().method() === 'POST'),
      this.submit.click(),
    ]);
    return response;
  }
}

/**
 * Birth date (dd.mm.yyyy) exactly `years` years before today, shifted by `dayOffset` days.
 * For age-boundary tests: (18, 0) = turns 18 today, (18, 1) = turns 18 tomorrow.
 */
export function birthDateYearsAgo(years: number, dayOffset = 0, today = new Date()): string {
  const d = new Date(today.getFullYear() - years, today.getMonth(), today.getDate() + dayOffset);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Birth date (dd.mm.yyyy) of someone who is `years` old today – safely away from a birthday. */
export function birthDateForAge(years: number, today = new Date()): string {
  const d = new Date(today.getFullYear() - years, today.getMonth(), today.getDate() - 30);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}
