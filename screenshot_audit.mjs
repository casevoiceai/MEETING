import { createServer } from 'http';
import { writeFileSync, mkdirSync } from 'fs';
import wsPkg from '/tmp/cc-agent/65610472/project/node_modules/ws/index.js';
const { WebSocket } = wsPkg;
import { execSync, spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const SCREENSHOTS_DIR = '/tmp/cc-agent/65610472/project/screenshots';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Start Chromium with remote debugging
const DEBUGGING_PORT = 9222;
const browser = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-web-security',
  `--remote-debugging-port=${DEBUGGING_PORT}`,
  '--window-size=1440,900',
  '--virtual-time-budget=5000',
  'about:blank',
], { stdio: 'pipe' });

browser.stderr.on('data', () => {}); // suppress noise

await sleep(2000);

// Get the list of targets from CDP
let targetInfo;
for (let i = 0; i < 10; i++) {
  try {
    const res = await fetch(`http://localhost:${DEBUGGING_PORT}/json`);
    const targets = await res.json();
    targetInfo = targets.find(t => t.type === 'page');
    if (targetInfo) break;
  } catch {}
  await sleep(500);
}

if (!targetInfo) {
  console.error('Could not connect to browser');
  browser.kill();
  process.exit(1);
}

console.log('Connected to browser, target:', targetInfo.id);

// Connect via WebSocket CDP
const ws = new WebSocket(targetInfo.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.on('open', resolve);
  ws.on('error', reject);
});

let cmdId = 1;
const pending = new Map();

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
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
  const result = await send('Page.captureScreenshot', { format: 'png', quality: 90 });
  const buf = Buffer.from(result.data, 'base64');
  writeFileSync(`${SCREENSHOTS_DIR}/${filename}`, buf);
  console.log(`Saved: ${filename} (${buf.length} bytes)`);
}

async function waitForReact() {
  // Poll until the nav bar is present
  for (let i = 0; i < 40; i++) {
    try {
      const result = await send('Runtime.evaluate', {
        expression: `document.querySelector('nav') !== null && document.querySelector('nav button') !== null`,
        returnByValue: true,
      });
      if (result.result.value === true) return;
    } catch {}
    await sleep(250);
  }
}

async function clickTab(tabText) {
  // Find button by text content and click it
  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const buttons = document.querySelectorAll('nav button');
        for (const btn of buttons) {
          if (btn.textContent.trim() === '${tabText}') {
            btn.click();
            return 'clicked: ' + btn.textContent.trim();
          }
        }
        return 'not found: ${tabText}';
      })()
    `,
    returnByValue: true,
  });
  console.log('clickTab result:', result.result.value);
}

// Enable necessary CDP domains
await send('Page.enable');
await send('Runtime.enable');

// Navigate to the app
console.log('Navigating to app...');
await send('Page.navigate', { url: 'http://127.0.0.1:5173' });

// Wait for load
await send('Page.loadEventFired').catch(() => {});
await sleep(3000); // Let React render + Supabase init

await waitForReact();
console.log('React rendered, taking screenshots...');

// --- Screenshot 1: MEETING (default) ---
await sleep(500);
await screenshot('01_meeting.png');

// --- Screenshot 2: DIRECT tab ---
await clickTab('DIRECT');
await sleep(1000);
await screenshot('02_direct.png');

// --- Screenshot 3: EMAIL tab ---
await clickTab('EMAIL');
await sleep(1500);
await screenshot('03_email.png');

// --- Screenshot 4: PROJECTS tab ---
await clickTab('PROJECTS');
await sleep(1500);
await screenshot('04_projects.png');

// --- Screenshot 5: DIRECT again (navigation cycle) ---
await clickTab('DIRECT');
await sleep(1000);
await screenshot('05_direct_again.png');

ws.close();
browser.kill();
console.log('Done.');
