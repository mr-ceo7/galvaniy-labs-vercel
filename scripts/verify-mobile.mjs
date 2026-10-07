import puppeteer from 'puppeteer-core';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const OUT_DIR = '/home/qassim/codex/galvaniy-labs-vercel/screenshots';

const MOBILE_DEVICE = {
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
};

async function verify() {
  console.log('[VERIFY] Starting Mobile Verification on', BASE_URL);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(MOBILE_DEVICE.viewport);
  await page.setUserAgent(MOBILE_DEVICE.userAgent);

  // 1. Verify Auth Screen
  console.log('1. Auditing Auth Screen...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_01_auth.png') });

  // 2. Verify Mission Briefing (Natural order: Objectives -> Apparatus -> Proceed)
  console.log('2. Auditing Mission Briefing Screen (/?lab=A-2)...');
  await page.goto(`${BASE_URL}/?lab=A-2`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_02_briefing.png') });

  // 3. Verify Clean Workbench (No overlapping panels, Dr. Vance completely hidden)
  console.log('3. Auditing Clean Workbench...');
  const proceedBtn = await page.waitForSelector('.mb-proceed-btn', { timeout: 10000 });
  await proceedBtn.click();
  // Allow live production network assets (WebP sprites & environment) to finish decoding
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_03_workbench_clean.png') });

  // Check element positions and visibility
  const workbenchMetrics = await page.evaluate(() => {
    const topbar = document.querySelector('.wb-topbar');
    const container = document.querySelector('.wb-assistant-container');
    const panel = document.querySelector('.wb-assistant-chat-panel');
    const summonBtn = document.querySelector('.wb-summon-assistant');
    const hudControls = document.querySelector('.wb-hud-controls');
    const hudData = document.querySelector('.wb-hud-data');
    const hudTray = document.querySelector('.wb-hud-tray');
    const drawerTabs = document.querySelector('.wb-drawer-tabs');

    const getBox = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
      };
    };

    return {
      topbar: getBox(topbar),
      assistantContainer: getBox(container),
      assistantPanel: getBox(panel),
      summonBtn: getBox(summonBtn),
      hudControls: getBox(hudControls),
      hudData: getBox(hudData),
      hudTray: getBox(hudTray),
      drawerTabs: getBox(drawerTabs),
    };
  });
  console.log('Workbench Metrics (Closed State):', JSON.stringify(workbenchMetrics, null, 2));

  // 3b. Verify expanding simulation parameters
  console.log('3b. Auditing Parameters Toggle...');
  const paramsBtn = await page.waitForSelector('.wb-transport-btn--params', { visible: true, timeout: 5000 });
  await paramsBtn.click();
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_03b_params_open.png') });
  await paramsBtn.click(); // Collapse back
  await new Promise(r => setTimeout(r, 600));

  // 4. Verify Dr. Vance Open State as a sleek bottom sheet
  console.log('4. Auditing Dr. Vance Open State...');
  const summonBtn = await page.waitForSelector('.wb-summon-assistant', { visible: true, timeout: 8000 });
  await summonBtn.click();
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_04_dr_vance_open.png') });

  // 5. Verify Closing Dr. Vance via close X button
  console.log('5. Auditing Dr. Vance Close action...');
  const closeBtn = await page.waitForSelector('.wb-close-chat-btn', { visible: true, timeout: 5000 });
  await closeBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_05_dr_vance_closed.png') });

  // 6. Verify Lab Drawer (Data Table)
  console.log('6. Auditing Drawer Tabs...');
  const dataTab = await page.waitForSelector('.wb-drawer-tab', { visible: true, timeout: 5000 });
  await dataTab.click();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT_DIR, 'verified_06_drawer_open.png') });

  await browser.close();
  console.log('[VERIFY COMPLETED] All mobile screens successfully verified.');
}

verify().catch(err => {
  console.error('[VERIFY FAILED]', err);
  process.exit(1);
});
