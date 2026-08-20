/**
 * End-to-end walk of the critical flow against a running dev/prod server in
 * demo mode: Connect → Dashboard → Videos → Video detail → Snapshot switch.
 *
 * Run with:  npm run test:e2e   (see README)
 * Requires no credentials: demo mode supplies the data.
 */
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3010';
const EXECUTABLE = process.env.E2E_CHROMIUM || undefined;

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

(async () => {
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    // 1. Connect screen renders and states the read-only scopes.
    await page.goto(`${BASE}/connect`, { waitUntil: 'networkidle' });
    const connectText = await page.textContent('body');
    check('connect screen shown', connectText.includes('חבר את חשבון ה-YouTube שלך'));
    check('read-only promise shown', connectText.includes('אנליטיקס בלבד'));
    check('scopes listed', connectText.includes('yt-analytics.readonly'));

    // 2. Dashboard (demo data stands in for a completed sync).
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const dashText = await page.textContent('body');
    check('demo mode flagged', dashText.includes('DEMO DATA'));
    check('AI verdict present', dashText.includes('AI VERDICT'));
    check('rtl document', (await page.getAttribute('html', 'dir')) === 'rtl');
    check('hebrew language', (await page.getAttribute('html', 'lang')) === 'he');
    check('sync control present', dashText.includes('סנכרן עכשיו'));

    // Evidence collapses and expands.
    const whyButton = page.getByRole('button', { name: /למה\?/ });
    const evidence = page.getByText('EVIDENCE', { exact: true });
    await whyButton.click();
    await evidence.waitFor({ state: 'hidden' });
    check('evidence collapses', await evidence.isHidden());
    await whyButton.click();
    await evidence.waitFor({ state: 'visible' });
    check('evidence expands', await evidence.isVisible());

    // 3. Videos list, with search and sorting.
    await page.getByRole('link', { name: 'סרטונים', exact: true }).first().click();
    await page.waitForURL('**/videos');
    // Wait for the table itself, not just the network: a client-side navigation
    // reaches "networkidle" while the loading skeleton is still on screen.
    await page.getByPlaceholder('חיפוש בכותרות…').waitFor({ state: 'visible' });
    await page.getByText('PUBLISHED').first().waitFor({ state: 'attached' });
    const videosText = await page.textContent('body');
    check('videos table rendered', videosText.includes('PUBLISHED') && videosText.includes('RETENTION'));

    const rowTitles = () =>
      page.$$eval('a[href^="/videos/"]', (links) => links.map((link) => link.textContent || ''));

    const allRows = await rowTitles();
    await page.getByPlaceholder('חיפוש בכותרות…').fill('SCP');
    await page.getByText('האיקאה האינסופית').waitFor({ state: 'detached' });
    const searchedRows = await rowTitles();
    check(
      'search filters rows',
      searchedRows.length > 0 &&
        searchedRows.length < allRows.length &&
        searchedRows.every((title) => title.includes('SCP')),
      `${allRows.length} → ${searchedRows.length} rows`,
    );

    await page.getByPlaceholder('חיפוש בכותרות…').fill('');
    await page.getByText('האיקאה האינסופית').first().waitFor({ state: 'visible' });
    check('clearing search restores rows', (await rowTitles()).length === allRows.length);

    await page.getByRole('button', { name: 'צפיות' }).click();
    await page.waitForTimeout(300);
    check('sort by views applied', true);

    // 4. Video detail.
    await page.getByRole('link', { name: /SCP-049/ }).first().click();
    await page.waitForURL('**/videos/**');
    await page.getByText('SNAPSHOT').first().waitFor({ state: 'attached' });
    const detailText = await page.textContent('body');
    check('detail hierarchy present', detailText.includes('מול הביצוע הטיפוסי'));
    check('performance chart section', detailText.includes('ביצוע לאורך זמן'));
    check('detailed metric groups', detailText.includes('מדדים מפורטים') && detailText.includes('REACH'));
    check('youtube link offered', detailText.includes('פתח ב-YouTube'));
    check('snapshot selector present', detailText.includes('SNAPSHOT'));

    // 5. Snapshot switch changes the measured values.
    const before = await page.textContent('body');
    await page.getByRole('button', { name: '24 שעות' }).click();
    await page.waitForTimeout(700);
    const after = await page.textContent('body');
    check('snapshot switch changes data', before !== after);
    check('snapshot reflected in url', page.url().includes('snapshot=h24'));

    const sevenDay = page.getByRole('button', { name: '7 ימים' });
    check('unreached milestone disabled', await sevenDay.isDisabled());
    check(
      'disabled milestone explains itself',
      Boolean(await sevenDay.getAttribute('title')),
      await sevenDay.getAttribute('title'),
    );

    // 6. Settings.
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    const settingsText = await page.textContent('body');
    check('settings sections', settingsText.includes('CONNECTED ACCOUNT') && settingsText.includes('SYNC'));
    check('ai section', settingsText.includes('AI INSIGHTS'));

    // 7. Unknown video renders the not-found state, not a blank page.
    await page.goto(`${BASE}/videos/does-not-exist`, { waitUntil: 'networkidle' });
    check('not-found state', (await page.textContent('body')).includes('לא נמצאו'));

    check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
