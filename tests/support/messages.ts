/**
 * UI texts and API paths, all taken verbatim from the manual QA report
 * (staging, 5 Nov 2026). If the copy changes, update it here only.
 */
export const msg = {
  ageError: 'Bitte wähle dein Alter aus.',
  codeInvalid: 'Dieser Code ist nicht gültig.',
  codeUsed: 'Dieser Code wurde bereits benutzt.',
  emailInvalid: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  plzInvalid: 'Bitte gib eine gültige 4-stellige PLZ ein.',
  birthDateMissing: 'Bitte gib dein Geburtsdatum ein.',
  /** Expected wording once L-13 is fixed. */
  birthDateInvalid: 'Bitte gib ein gültiges Datum ein.',
  birthDateUnder18: 'Bitte gib ein gültiges Geburtsdatum ein. Die Teilnahme ist ab 18 Jahren möglich.',
  genderMissing: 'Bitte wähle eine Option aus.',
  firstNameMissing: 'Bitte gib deinen Vornamen ein.',
  lastNameMissing: 'Bitte gib deinen Nachnamen ein.',

  // Redeem errors
  network: 'Verbindung fehlgeschlagen. Bitte versuche es erneut.',
  tooManyAttempts: 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.',

  // Age gate and campaign status (checked 5 Nov 2026)
  underageTitle: 'Zutritt nicht möglich',
  underageText: /ausschließlich für Personen ab 18 Jahren möglich/,
  campaignEnded: /Das Gewinnspiel ist beendet/,
  campaignComingSoon: /Bald ist es soweit/,

  /** Intro on the contact form; in the current version the result comes after email verification. */
  contactIntro: /bestätige deine E-Mail innerhalb von 24 Stunden/,

  resultWinBadge: 'SOFORTGEWINN',
  resultWinHeadline: /Herzlichen Glückwunsch!.*Amazon-Gutschein gewonnen/,
  resultNoWinHeadline: 'Leider kein Sofortgewinn.',

  verifyHeadline: /Bestätige deine E-Mail/,
  verifySentTo: /Wir haben dir einen Bestätigungslink an .+ gesendet/,
  resendButton: /E-Mail erneut senden/,
  resendWait: /Erneut senden in \d+ s/,
  resendSent: /Wir haben dir einen neuen Bestätigungslink gesendet/,
  resendLimit: /maximale Anzahl an Bestätigungslinks/,
  resendFailed: /Der Link konnte nicht gesendet werden/,
  emailAlreadyUsed: /Mit dieser E-Mail-Adresse wurde bereits am Gewinnspiel teilgenommen/,
  emailTakenTitle: /Diese E-Mail-Adresse wurde bereits verwendet/,
  verifyThrottled: /Dein Bestätigungslink bleibt gültig/,
  verifyUnreachable: /Wir konnten den Link gerade nicht prüfen/,
  resultWinTitle: /Herzlichen Glückwunsch!/,
  resultAmazon: /Dein Amazon-Gutschein wird in Kürze an deine E-Mail Adresse gesendet/,
  resultCineplexx: /Dein Cineplexx-Gutschein wird in Kürze an deine E-Mail Adresse gesendet/,
  resultDrawTitle: /Danke für deine Teilnahme!/,
  resultDraw: /Du nimmst an der Verlosung für den Hauptpreis teil/,
  verifyLinkInvalid: /LINK UNGÜLTIG/i,
  verifyNewLink: /Neuen Link anfordern/,

  consentTimestamp: /Einwilligung mit Zeitstempel dokumentiert/,
};

export const api = {
  redeem: '/api/participation/redeem',
  contact: '/api/participation/contact',
  verifyEmail: '/api/participation/verify-email',
  campaignStatus: '/api/campaign/status',
};

/** Campaign states returned by GET /api/campaign/status in the `state` field. */
export type CampaignState = 'active' | 'coming-soon' | 'ended';

export const footerLinks = [
  'Teilnahmebedingungen',
  'Datenschutz Gewinnspiel',
  'Datenschutz Consumer Online Panel',
  'Impressum',
  'Barrierefreiheitserklärung',
  'Häufige Fragen (FAQ)',
] as const;

/** German date of an ISO timestamp as the site shows it, e.g. "16.06.2026". */
export function deDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  });
}

export const ageGroups = ['18-24', '25-34', '35-44', '45+'] as const;
export type AgeGroup = (typeof ageGroups)[number];
