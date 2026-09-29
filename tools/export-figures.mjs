/**
 * 把已画好的动作图导出成小程序可用的资源
 *
 *  1) 先生成透明底 SVG  → assets-src/figures/   （源文件，不进小程序包）
 *  2) 再用 Chrome 截图成 PNG → miniprogram/assets/movements/（小程序实际引用）
 *
 * 用法：node tools/export-figures.mjs          # 只生成 SVG
 *      node tools/export-figures.mjs --render  # 生成 SVG 并调用 Chrome 渲染 PNG
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defs, place, figPushup, figSix } from './vendor/build-cards.mjs';
// 其余五艺的逐式示意图：每艺一个模块（图多了别都挤进 build-cards.mjs）
import { figSquat } from './vendor/figures/squat.mjs';
import { figPullup } from './vendor/figures/pullup.mjs';
import { figLegraise } from './vendor/figures/legraise.mjs';
import { figBridge } from './vendor/figures/bridge.mjs';
import { figHandstand } from './vendor/figures/handstand.mjs';

const W = 840, H = 520, PAD = 18;
const ART_IDS = ['pushup', 'squat', 'pullup', 'legraise', 'bridge', 'handstand'];
const STEP_FIG = {
  pushup: figPushup, squat: figSquat, pullup: figPullup,
  legraise: figLegraise, bridge: figBridge, handstand: figHandstand
};

const root = fileURLToPath(new URL('..', import.meta.url));            // fitness-miniapp/
const srcDir = path.join(root, 'assets-src', 'figures');
const outDir = path.join(root, 'miniprogram', 'assets', 'movements');
fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const jobs = [];

// 六艺各十式（逐式示意图）+ 六艺各一张代表图（首页卡片封面）
ART_IDS.forEach((id, i) => {
  const fig = STEP_FIG[id];
  if (typeof fig !== 'function') throw new Error(`没有 ${id} 的逐式图生成器`);
  for (let no = 1; no <= 10; no++) {
    jobs.push({ name: `mov-${id}-${String(no).padStart(2, '0')}`, fig: fig(no) });
  }
  jobs.push({ name: `art-${id}`, fig: figSix(i) });
});

for (const job of jobs) {
  const body = place(job.fig.parts, { x: 0, y: 0, w: W, h: H }, PAD, job.fig.extra);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`,
    ` font-family="'Segoe UI','Microsoft YaHei',sans-serif">`,
    defs(false),
    body,
    '</svg>'
  ].join('\n');
  fs.writeFileSync(path.join(srcDir, `${job.name}.svg`), svg, 'utf8');
}
console.log(`SVG 已生成：${jobs.length} 个 → ${path.relative(root, srcDir)}`);

if (!process.argv.includes('--render')) {
  console.log('（加 --render 参数可继续渲染 PNG）');
  process.exit(0);
}

// ---- 渲染 PNG ----
const chrome = [
  process.env.CHROME_PATH,
  'C:/Users/suojianfei/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

if (!chrome) {
  console.error('没找到 Chrome/Edge，请设置环境变量 CHROME_PATH');
  process.exit(1);
}

let bytes = 0;
for (const job of jobs) {
  const svgPath = path.join(srcDir, `${job.name}.svg`);
  const pngPath = path.join(outDir, `${job.name}.png`);
  const url = 'file:///' + svgPath.replace(/\\/g, '/');
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${W},${H}`,
    `--user-data-dir=${path.join(root, '.chrome-tmp')}`,
    `--screenshot=${pngPath}`,
    url
  ], { stdio: 'ignore' });
  if (fs.existsSync(pngPath)) bytes += fs.statSync(pngPath).size;
}
fs.rmSync(path.join(root, '.chrome-tmp'), { recursive: true, force: true });
console.log(`PNG 已生成：${jobs.length} 个，共 ${(bytes / 1024).toFixed(1)} KB → ${path.relative(root, outDir)}`);
