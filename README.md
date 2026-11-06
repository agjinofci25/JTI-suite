# Campaign E2E tests (Playwright + TypeScript)

Automated UI and API tests for a code-redeem sweepstakes page: enter a 6-character code,
choose an age group, accept the terms, fill in the contact form, confirm the email and see
the result. Working behaviour is covered by regression tests; open bugs are tests tagged
`@known-bug <ID>` that **fail until the bug is fixed**.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env      # then fill in the URL, production host and codes
```

All environment details (test URL, production host, test codes, test email) live in `.env`,
which is never committed.

The suite **refuses to start** unless `PROD_HOST` is set and the `BASE_URL` host has a test
label (`staging`, `development`, `dev`, `test`, `qa`) and is not `PROD_HOST`, so it can never
run against production by accident. Any request to `PROD_HOST` also fails the test.

## Running

| Command | What it runs |
|---|---|
| `npm test` | Everything except the code-consuming full flow. |
| `npm run test:regression` | Everything that currently works – should be green. Use this in CI. |
| `npm run test:known-bugs` | Only the bug tests. Each one that turns green = bug fixed. |
| `npm run test:full-flow` | Full redeem → contact → verify flow. **Uses up codes and sends emails.** |
| `npm run test:ui` | Playwright's interactive UI mode, good for debugging. |
| `npm run report` | Opens the HTML report (screenshots, video and trace for failures). |

Projects: `desktop` (Chrome, 1440 px) runs everything, including the server (API) tests and
the visual snapshot; `tablet` (768 px) and `mobile` (Android phone, 375 px) run the `@layout`
tests plus mobile-specific ones.

To add Safari, add a project with `devices['iPhone 13']` or `devices['Desktop Safari']` in
`playwright.config.ts` and run `npx playwright install webkit`.

## Test codes

Codes are single-use, so the suite treats them carefully:

| Variable | Used by | Consumed? |
|---|---|---|
| `ZZZZZZ` (built-in) | invalid-code, double-click, keyboard and API tests | No – always rejected |
| `CODE_USED` | "already used" / 409 test | No – already used |
| `CODE_RESUMABLE_NO_WIN` | contact form, verification and result tests | No – every contact request is blocked or faked. **Lapses 24 h after the first redeem** – then put in another unused code. |
| `CODE_FRESH_WIN`, `CODE_FRESH_NO_WIN` | `@consumes-code` full flow | **Yes** – put new codes in before every run |

Email confirmation is not automated: the verification and result screens are tested with
faked server answers (`11-verification-and-result`), and the full-flow test stops on the
"confirm your email" page.

## Files

```
playwright.config.ts          projects, test-environment guard, traces/screenshots on failure
tests/support/env.ts          .env loading + test-environment guard
tests/support/messages.ts     all UI texts and API paths (single source of truth)
tests/support/fixtures.ts     page objects + auto checks (no JS errors, no prod requests)
tests/support/mocks.ts        fakes the campaign status for the ended / coming-soon tests
tests/pages/CampaignPage.ts   landing page: code boxes, age, consent, submit
tests/pages/ContactPage.ts    contact form after redeem
tests/specs/01–12             the tests, grouped by flow step
                              11 = verification page + result screens (server answers faked)
                              12 = server-side validation, straight to the API
```

## Visual snapshot

Snapshot baselines are not committed (they are screenshots of the site). Create them once
locally before the first run:

```bash
npx playwright test 07-layout --update-snapshots
```

Baselines are stored per project and OS (e.g. `landing-desktop-darwin.png`), so a baseline
made on macOS will not be used on Linux CI – generate the CI baseline in the same environment
CI runs in (e.g. the `mcr.microsoft.com/playwright` Docker image). Update them with the same
command after intended design changes.

## Debugging selectors

```bash
npx playwright codegen <your BASE_URL>
```

Click through the form and compare the generated locators with `tests/pages/*`.
