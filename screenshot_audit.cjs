'use strict';
const { WebSocket } = require('/tmp/cc-agent/65610472/project/node_modules/ws/index.js');
const { writeFileSync, mkdirSync } = require('fs');
const { execSync, spawnSync, spawn } = require('child_process');

const SCREENSHOTS_DIR = '/tmp/cc-agent/65610472/project/screenshots';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const DEBUGGING_PORT = 9444;
const APP_URL = 'http://127.0.0.1:5173';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Kill any leftover chromium on this port
  try { execSync(`pkill -f "remote-debugging-port=${DEBUGGING_PORT}" 2>/dev/null`); } catch {}
  await sleep(500);

  console.log('Starting Chromium with remote debugging...');
  const browser = spawn('chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUGGING_PORT}`,
    '--window-size=1440,900',
    'about:blank',
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: false,
  });

  browser.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('DevTools listening')) console.log('DevTools ready');
  });

  // Wait for DevTools to be available
  let targetInfo = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const resp = await fetch(`http://localhost:${DEBUGGING_PORT}/json`);
      const targets = await resp.json();
      targetInfo = targets.find(t => t.type === 'page');
      if (targetInfo) break;
    } catch {}
  }

  if (!targetInfo) {
    console.error('FATAL: Could not connect to Chromium DevTools');
    browser.kill();
    process.exit(1);
  }

  console.log('Connected. Opening WebSocket...');

  const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let cmdId = 1;
  const pending = new Map();
  const events = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = cmdId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function screenshot(filename) {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(result.data, 'base64');
    writeFileSync(`${SCREENSHOTS_DIR}/${filename}`, buf);
    console.log(`  Saved ${filename} (${Math.round(buf.length/1024)}KB)`);
    return buf.length;
  }

  async function waitForSelector(selector, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const r = await send('Runtime.evaluate', {
        expression: `document.querySelector(${JSON.stringify(selector)}) !== null`,
        returnByValue: true,
      });
      if (r.result && r.result.value === true) return true;
      await sleep(200);
    }
    return false;
  }

  async function clickTabByText(tabText) {
    const r = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btns = Array.from(document.querySelectorAll('nav button'));
          const btn = btns.find(b => b.textContent.trim() === ${JSON.stringify(tabText)});
          if (btn) { btn.click(); return true; }
          return false;
        })()
      `,
      returnByValue: true,
    });
    if (!r.result || r.result.value !== true) {
      console.error(`  WARNING: Tab "${tabText}" not found`);
    }
    return r.result && r.result.value;
  }

  async function getActiveTab() {
    const r = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const btns = Array.from(document.querySelectorAll('nav button'));
          const active = btns.find(b => b.style.backgroundColor === 'rgb(19, 40, 69)' || b.getAttribute('aria-selected') === 'true');
          return active ? active.textContent.trim() : 'unknown';
        })()
      `,
      returnByValue: true,
    });
    return r.result ? r.result.value : 'unknown';
  }

  async function getAllTabs() {
    const r = await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('nav button')).map(b => b.textContent.trim()).join(', ')`,
      returnByValue: true,
    });
    return r.result ? r.result.value : '';
  }

  // Enable domains
  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate
  console.log('Navigating to', APP_URL);
  await send('Page.navigate', { url: APP_URL });
  await sleep(4000); // Wait for React + initial render

  const navFound = await waitForSelector('nav button');
  if (!navFound) {
    console.error('Navigation bar not found after timeout');
  }

  const tabs = await getAllTabs();
  console.log('Found tabs:', tabs);

  // === SCREENSHOT 1: MEETING (default) ===
  console.log('\n[1] MEETING tab (default state)');
  await sleep(500);
  await screenshot('01_meeting.png');

  // === SCREENSHOT 2: DIRECT ===
  console.log('\n[2] Clicking DIRECT tab');
  await clickTabByText('DIRECT');
  await sleep(1200);
  await screenshot('02_direct.png');

  // === SCREENSHOT 3: EMAIL ===
  console.log('\n[3] Clicking EMAIL tab');
  await clickTabByText('EMAIL');
  await sleep(1500);
  await screenshot('03_email.png');

  // === SCREENSHOT 4: PROJECTS ===
  console.log('\n[4] Clicking PROJECTS tab');
  await clickTabByText('PROJECTS');
  await sleep(1500);
  await screenshot('04_projects.png');

  // === SCREENSHOT 5: DIRECT again ===
  console.log('\n[5] Clicking DIRECT again (cycle test)');
  await clickTabByText('DIRECT');
  await sleep(1200);
  await screenshot('05_direct_cycle.png');

  ws.close();
  browser.kill();
  console.log('\nAll screenshots saved to:', SCREENSHOTS_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
