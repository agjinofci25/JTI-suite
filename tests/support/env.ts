import 'dotenv/config';

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export const env = {
  baseURL: optional('BASE_URL') ?? '',
  /** Production host – set in .env, never in the code. Required (see assertStaging). */
  prodHost: optional('PROD_HOST') ?? '',

  codeResumableNoWin: optional('CODE_RESUMABLE_NO_WIN'),
  codeUsed: optional('CODE_USED'),
  codeFreshWin: optional('CODE_FRESH_WIN'),
  codeFreshNoWin: optional('CODE_FRESH_NO_WIN'),

  runConsuming: optional('RUN_CONSUMING_TESTS') === 'true',
  testEmail: optional('TEST_EMAIL') ?? 'test+e2e@example.com',
  testFirstName: optional('TEST_FIRST_NAME') ?? 'Test',
  testLastName: optional('TEST_LAST_NAME') ?? 'Automation',
  testPlz: optional('TEST_PLZ') ?? '1030',

  /** A code that staging always rejects – safe to submit any number of times. */
  invalidCode: 'ZZZZZZ',
};

/** Host labels that mark a non-production environment, e.g. "staging" or "development". */
const TEST_HOST_MARKER = /(^|[.-])(staging|development|dev|test|qa)([.-]|$)/;

/** Refuse to run against production or anything that does not look like a test environment. */
export function assertStaging(url: string): void {
  if (!url) {
    throw new Error('BASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (!env.prodHost) {
    throw new Error('PROD_HOST is not set. Add the production host to .env (see .env.example).');
  }
  const host = new URL(url).hostname;
  if (host === env.prodHost || host.endsWith(`.${env.prodHost}`)) {
    throw new Error(`Refusing to run: BASE_URL host "${host}" is the production host.`);
  }
  if (!TEST_HOST_MARKER.test(host)) {
    throw new Error(
      `Refusing to run: BASE_URL host "${host}" does not look like a test environment ` +
        '(expected a label such as "staging" or "development"). ' +
        'These tests submit forms and must never run against production.',
    );
  }
}
