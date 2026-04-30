import { test, expect } from '@playwright/test';

/**
 * End-to-end checks for the bundled `index.html` (built from src/, React
 * inlined, no CDN dependency). Run with `pnpm test:e2e`. Playwright's
 * webServer config in playwright.config.ts spins up `python3 -m http.server`
 * on port 8765 automatically.
 */

test.describe('DateTimePicker — single-file demo', () => {
  test('panel renders directly, no trigger to click', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.dtp-panel')).toBeVisible({ timeout: 10000 });
    // Calendar header, day-of-week row, calendar grid, clock SVG, numeric
    // inputs, action buttons all present.
    await expect(page.locator('.dtp-cal-header')).toBeVisible();
    await expect(page.locator('.dtp-cal-grid')).toBeVisible();
    await expect(page.locator('.dtp-clock-svg')).toBeVisible();
    await expect(page.getByLabel('Tag')).toBeVisible();
    await expect(page.getByLabel('Monat')).toBeVisible();
    await expect(page.getByLabel('Jahr')).toBeVisible();
    await expect(page.getByLabel('Stunde')).toBeVisible();
    await expect(page.getByLabel('Minute')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Heute$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Jetzt$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^OK$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Abbrechen$/ })).toBeVisible();
  });

  test('artefact is fully self-contained — zero external requests, zero JS errors', async ({ page }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

    await page.goto('/index.html');
    await expect(page.locator('.dtp-panel')).toBeVisible({ timeout: 10000 });

    const external = requests.filter((u) => !u.startsWith('http://localhost:8765/'));
    expect(external, `unexpected external requests:\n${external.join('\n')}`).toEqual([]);
    expect(errors, `unexpected JS errors:\n${errors.join('\n')}`).toEqual([]);
  });

  /* ─── arrow-key bumps update the visible focused input value ─── */

  test('ArrowUp on focused day input bumps the visible value', async ({ page }) => {
    await page.goto('/index.html');
    const day = page.getByLabel('Tag');
    await day.focus();
    const before = await day.inputValue();
    await day.press('ArrowUp');
    const after = await day.inputValue();
    expect(after).not.toBe(before);
  });

  test('ArrowDown on focused hour input decrements the visible value', async ({ page }) => {
    await page.goto('/index.html');
    const hour = page.getByLabel('Stunde');
    await hour.focus();
    const before = await hour.inputValue();
    await hour.press('ArrowDown');
    const after = await hour.inputValue();
    expect(after).not.toBe(before);
  });

  test('ArrowUp on focused minute input increments the visible value', async ({ page }) => {
    await page.goto('/index.html');
    const minute = page.getByLabel('Minute');
    await minute.focus();
    const before = await minute.inputValue();
    await minute.press('ArrowUp');
    const after = await minute.inputValue();
    expect(after).not.toBe(before);
  });

  /* ─── typing UX preserved (don't clobber in-progress values) ─── */

  test('typing a single digit into the day field is NOT auto-padded mid-edit', async ({ page }) => {
    await page.goto('/index.html');
    const day = page.getByLabel('Tag');
    await day.focus();
    await day.fill('');
    await day.type('1');
    // The user is mid-edit (heading for "10", "12", etc.). Shouldn't be
    // clobbered to "01" before the second digit arrives.
    expect(await day.inputValue()).toBe('1');
  });

  /* ─── stepper buttons + clock interaction also force-sync focused field ─── */

  test('stepper button (▲) bumps the day even if the day input is focused', async ({ page }) => {
    await page.goto('/index.html');
    const day = page.getByLabel('Tag');
    await day.focus();
    const before = await day.inputValue();
    // Pick the day-up stepper. The picker has 3 ▲ buttons in the date row
    // (day / month / year) and 2 in the time row (hour / minute) — the
    // first ▲ in document order is day-up.
    await page.locator('.dtp-stepper').filter({ hasText: '▲' }).first().click();
    const after = await day.inputValue();
    expect(after).not.toBe(before);
  });

  test('Heute button resets the date to today', async ({ page }) => {
    await page.goto('/index.html');
    const day = page.getByLabel('Tag');
    const month = page.getByLabel('Monat');
    const year = page.getByLabel('Jahr');
    // Bump the day a few times to drift from today, then press Heute.
    await day.focus();
    await day.press('ArrowUp');
    await day.press('ArrowUp');
    await page.getByRole('button', { name: /^Heute$/ }).click();
    const today = new Date();
    expect(await day.inputValue()).toBe(String(today.getDate()).padStart(2, '0'));
    expect(await month.inputValue()).toBe(String(today.getMonth() + 1).padStart(2, '0'));
    expect(await year.inputValue()).toBe(String(today.getFullYear()));
  });
});
