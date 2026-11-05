// Records docs/demo/edulens-demo.mp4: a captioned walkthrough of the demo school.
//
// It isn't part of either npm project; run it from a scratch folder:
//   1. npm i playwright@1.55.0 ffmpeg-static@5.2.0 && npx playwright install chromium
//   2. backend:  npm run seed:demo -- --reset
//                PORT=5055 DEMO_LOGIN=true RATE_LIMIT_MAX=5000 npm start
//      frontend: VITE_API_URL= API_PROXY_TARGET=http://127.0.0.1:5055 npx vite --port 5288
//   3. node record-demo.mjs http://localhost:5288 take
//   4. Trim to the "start"/"end" times in take/marks.json and encode:
//      ffmpeg -ss <start> -to <end> -i take/raw.webm -vf "fade=t=in:d=0.6,format=yuv420p"
//        -c:v libx264 -preset slow -crf 25 -r 30 -movflags +faststart -an edulens-demo.mp4
//
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [origin = 'http://localhost:5288', outDir = 'out'] = process.argv.slice(2);
const W = 1280;
const H = 720;
fs.mkdirSync(outDir, { recursive: true });

// Injected into every document: caption bar, fake cursor with click ripple, full-screen cards.
const overlay = () => {
  const css = `
    #demo-caption{position:fixed;left:50%;bottom:28px;transform:translate(-50%,12px);z-index:2147483646;
      max-width:960px;padding:14px 26px;border-radius:14px;background:rgba(15,23,42,.92);color:#fff;
      font:600 22px/1.35 'Plus Jakarta Sans Variable',system-ui,sans-serif;text-align:center;letter-spacing:-.01em;
      box-shadow:0 12px 32px rgba(15,23,42,.35);opacity:0;transition:opacity .35s ease,transform .35s ease;pointer-events:none}
    #demo-caption.on{opacity:1;transform:translate(-50%,0)}
    #demo-caption.top{bottom:auto;top:76px}
    #demo-caption small{display:block;margin-top:2px;font-weight:500;font-size:17px;color:#cbd5e1}
    #demo-cursor{position:fixed;left:0;top:0;z-index:2147483647;width:22px;height:22px;pointer-events:none;
      transform:translate(-100px,-100px);transition:transform .02s linear}
    #demo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .demo-ripple{position:fixed;z-index:2147483645;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
      background:rgba(79,70,229,.35);border:2px solid rgba(79,70,229,.8);pointer-events:none;animation:demo-ripple .5s ease-out forwards}
    @keyframes demo-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}
    #demo-card{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:18px;padding:40px;text-align:center;color:#fff;
      background:radial-gradient(1200px 600px at 30% 20%,#6d5ff0 0%,#4338ca 45%,#1e1b4b 100%);
      font-family:'Plus Jakarta Sans Variable',system-ui,sans-serif;opacity:0;transition:opacity .5s ease;pointer-events:none}
    #demo-card.on{opacity:1}
    #demo-card .logo{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800;letter-spacing:-.02em}
    #demo-card .logo span{display:inline-flex;width:52px;height:52px;border-radius:14px;background:#fff;color:#4f46e5;
      align-items:center;justify-content:center;font-size:30px}
    #demo-card h1{margin:0;color:#fff;font-size:52px;font-weight:800;letter-spacing:-.03em;line-height:1.1;max-width:1000px}
    #demo-card p{margin:0;font-size:24px;color:#e0e7ff;max-width:900px;line-height:1.4}
    #demo-card .url{margin-top:10px;padding:12px 24px;border-radius:999px;background:#fff;color:#3730a3;font-size:24px;font-weight:700}
    #demo-card .stack{font-size:18px;color:#c7d2fe}`;

  const ensure = () => {
    if (document.getElementById('demo-caption')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const card = document.createElement('div');
    card.id = 'demo-card';
    document.body.append(caption, cursor, card);
    const saved = sessionStorage.getItem('demo-caption');
    if (saved) {
      caption.innerHTML = saved;
      caption.classList.add('on');
    }
    const pos = sessionStorage.getItem('demo-cursor');
    if (pos) cursor.style.transform = pos;
  };

  document.addEventListener('DOMContentLoaded', ensure);
  document.addEventListener('mousemove', (e) => {
    const cursor = document.getElementById('demo-cursor');
    if (!cursor) return;
    cursor.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
    sessionStorage.setItem('demo-cursor', cursor.style.transform);
  }, true);
  document.addEventListener('mousedown', (e) => {
    const ripple = document.createElement('div');
    ripple.className = 'demo-ripple';
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, true);

  window.__caption = (html, top = false) => {
    ensure();
    const caption = document.getElementById('demo-caption');
    if (!html) {
      caption.classList.remove('on');
      sessionStorage.removeItem('demo-caption');
      return;
    }
    caption.classList.remove('on');
    setTimeout(() => {
      caption.innerHTML = html;
      caption.classList.toggle('top', top);
      caption.classList.add('on');
    }, caption.innerHTML ? 250 : 0);
    sessionStorage.setItem('demo-caption', html);
  };
  window.__card = (html) => {
    ensure();
    const card = document.getElementById('demo-card');
    if (html) card.innerHTML = html;
    card.classList.toggle('on', Boolean(html));
  };
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: W, height: H } },
});
await context.addInitScript(overlay);
const page = await context.newPage();
const t0 = Date.now();
const marks = {};
const mark = (name) => {
  marks[name] = (Date.now() - t0) / 1000;
  console.log(`${marks[name].toFixed(1)}s ${name}`);
};
const wait = (ms) => page.waitForTimeout(ms);

let mouse = { x: W / 2, y: H / 2 };
const moveTo = async (target, { dx = 0, dy = 0 } = {}) => {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const x = box.x + box.width / 2 + dx;
  const y = box.y + box.height / 2 + dy;
  const steps = Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 14));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
  await wait(180);
};
const click = async (target, opts) => {
  await moveTo(target, opts);
  await page.mouse.down();
  await wait(90);
  await page.mouse.up();
  await wait(250);
};
const caption = async (text, sub, { top = false } = {}) => {
  await page.evaluate(
    ([html, atTop]) => window.__caption(html, atTop),
    [text ? `${text}${sub ? `<small>${sub}</small>` : ''}` : null, top]
  );
  await wait(400);
};
const card = (html) => page.evaluate((h) => window.__card(h), html);
const smoothScroll = async (pixels, ms = 1200) => {
  const steps = Math.round(ms / 40);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, pixels / steps);
    await wait(40);
  }
};
const LOGO = `<div class="logo"><span><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4f46e5"
  stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>
  <circle cx="10.5" cy="10.5" r="2.2" fill="#f5b301" stroke="none"/></svg></span>Edulens LMS</div>`;

try {
// ---- 0. Title card over the sign-in page --------------------------------
await page.goto(`${origin}/login`, { waitUntil: 'networkidle' });
await card(`${LOGO}<h1>Marks, reports and parent updates for Foundation Phase schools</h1>
  <p>A learning management system for South African schools, Grade R to Grade 3.</p>`);
mark('start');
await wait(4200);
await card(null);
await wait(700);

// ---- 1. One-click demo sign-in -----------------------------------------
await caption('Anyone can explore the demo with one click.', 'No account or password needed.');
const demoButtons = page.locator('.el-demo__option');
await moveTo(demoButtons.nth(0));
await moveTo(demoButtons.nth(2));
await wait(500);
await click(page.getByRole('button', { name: /demo teacher/ }));

// ---- 2. Teacher dashboard ----------------------------------------------
await page.getByText('Still to mark').waitFor();
await caption('A teacher’s dashboard starts with what still needs marking.');
await wait(1600);
const toMark = page.getByRole('link', { name: /Reading for meaning/ }).first();
await moveTo(toMark);
await wait(700);
await click(toMark);

// ---- 3. Marks entry ------------------------------------------------------
const markInputs = page.getByLabel(/^Mark for /);
await markInputs.first().waitFor();
await caption('Marks go in fast: Enter jumps to the next learner.', null, { top: true });
await wait(800);
const empty = [];
for (const input of await markInputs.all()) if (!(await input.inputValue())) empty.push(input);
const scores = ['14', '17', '9', '12'];
const total = Number((await markInputs.first().getAttribute('aria-label')).match(/out of ([\d.]+)/)?.[1] ?? 20);
for (const [i, input] of empty.slice(0, 3).entries()) {
  await click(input);
  const score = String(Math.min(Number(scores[i]), total));
  await input.pressSequentially(score, { delay: 160 });
  await wait(450);
  if (i === 0) await caption('Each mark shows its percentage and CAPS level straight away.', null, { top: true });
  await wait(i === 0 ? 1400 : 500);
}
await wait(600);
await click(page.getByRole('button', { name: 'Save marks' }));
await wait(1800);

// ---- 4. Class marksheet ------------------------------------------------
await caption(null);
await click(page.getByRole('link', { name: 'My classes' }).first());
const classCard = page.getByRole('link', { name: /Grade 1A/ }).first();
await classCard.waitFor();
await wait(600);
await click(classCard);
const marksTab = page.getByRole('tab', { name: /Marksheet/ });
await marksTab.waitFor();
await wait(500);
await click(marksTab);
await page.locator('.el-marksheet__cell--low').first().waitFor().catch(() => {});
await caption('The class marksheet shows every learner against every assessment.', 'Marks below 50% stand out.');
await wait(500);
await smoothScroll(260, 900);
await wait(500);
await moveTo(page.locator('.el-marksheet__cell--low').first());
await wait(2600);

// ---- 5. AI worksheet ---------------------------------------------------
await caption(null);
await click(page.getByRole('link', { name: 'Worksheets' }).first());
const newWorksheet = page.getByRole('button', { name: /New worksheet/ }).first();
await newWorksheet.waitFor();
await wait(500);
await click(newWorksheet);
const grade = page.getByLabel('Grade', { exact: true });
await grade.waitFor();
await caption('Teachers can ask AI for a printable worksheet on any CAPS topic.');
await wait(600);
await moveTo(grade);
await grade.selectOption('1');
await wait(500);
const subject = page.getByLabel('Subject', { exact: true });
await moveTo(subject);
const subjectValue = await subject.locator('option').evaluateAll(
  (options) => (options.find((o) => /Math/.test(o.textContent)) ?? options.find((o) => o.value))?.value
);
await subject.selectOption(subjectValue);
await wait(500);
const topic = page.getByLabel(/^Topic/);
await moveTo(topic);
const topicValue = await topic.locator('option').evaluateAll((options) => options.find((o) => o.value)?.value);
if (topicValue) await topic.selectOption(topicValue);
await wait(400);
const extra = page.getByLabel(/^Anything else/);
await click(extra);
await extra.pressSequentially('Use a spaza shop theme, numbers up to 20', { delay: 45 });
await wait(500);
await click(page.getByRole('button', { name: 'Create worksheet' }));
mark('aiStart');
await caption('The AI writes the questions and an answer key…');
await page.getByRole('article').first().waitFor({ timeout: 120000 });
mark('aiEnd');
await caption('Teachers check and edit it, then save it to the school’s library or print it.');
await wait(900);
await moveTo(page.getByRole('article').first(), { dy: -120 });
await smoothScroll(600, 2600);
await wait(1500);

// ---- 6. Switch to the school admin ------------------------------------
await caption('Every role sees its own view. Next: the school admin.');
await click(page.getByRole('button', { name: 'Try another role' }));
await click(page.getByRole('button', { name: /demo school admin/ }));
await page.getByText('Classes at a glance').waitFor().catch(async (error) => {
  await page.screenshot({ path: path.join(outDir, 'fail.png') });
  throw error;
});
await caption('School admins see the whole school at a glance.');
await wait(1200);
await moveTo(page.getByText('Needs attention'));
await wait(1600);

await click(page.getByRole('link', { name: 'Reports' }).first());
await page.waitForLoadState('networkidle');
await caption('Reports compare classes, subjects and CAPS levels.');
await wait(1500);
await smoothScroll(450, 2200);
await wait(1800);

await click(page.getByRole('link', { name: 'Year end' }).first());
await page.waitForLoadState('networkidle');
await caption('At year end, learners are promoted, kept back or finish Grade 3 in one step.');
await wait(2200);
await smoothScroll(300, 1500);
await wait(1800);

// ---- 7. Parent -----------------------------------------------------------
await caption('Parents follow their children from their phones.');
await click(page.getByRole('button', { name: 'Try another role' }));
await click(page.getByRole('button', { name: /demo parent/ }));
const child = page.getByRole('link', { name: /Amahle/ }).first();
await child.waitFor();
await wait(1400);
await click(child);
await page.waitForLoadState('networkidle');
await caption('They see every mark, with the teacher’s comment.', 'Support and medical notes stay private to the school.');
await wait(1600);
await smoothScroll(500, 2400);
await wait(2200);

// ---- 8. End card ---------------------------------------------------------
await caption(null);
await card(`${LOGO}<h1>Try it yourself</h1>
  <div class="url">edulens-lms-app.onrender.com</div>
  <p>Pick a role on the sign-in page. No password needed.</p>
  <p class="stack">React 19 · Express 5 · PostgreSQL · Groq AI</p>`);
await wait(4500);
mark('end');
} catch (error) {
  await page.screenshot({ path: path.join(outDir, 'fail.png') });
  console.log('FAILED at', page.url(), error.message.split('\n')[0]);
  await context.close();
  await browser.close();
  process.exit(1);
}

await context.close();
await browser.close();
const video = fs.readdirSync(outDir).find((f) => f.endsWith('.webm') && f !== 'raw.webm');
fs.renameSync(path.join(outDir, video), path.join(outDir, 'raw.webm'));
fs.writeFileSync(path.join(outDir, 'marks.json'), JSON.stringify(marks, null, 2));
console.log('done', marks);
