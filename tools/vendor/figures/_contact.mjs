/**
 * 示意图联排（contact sheet）—— 画完必须"看"一遍，别靠想象
 *
 * 用法：node tools/vendor/figures/_contact.mjs squat
 * 产物：%TEMP%/fig-<art>.png（2 列 × 5 行，每格带序号与动作名）
 *
 * 为什么要有这个：单个 SVG 看不出"这一式像不像那个动作"，
 * 10 张排一起才能一眼看出比例是否一致、脚有没有站在地上、姿势是不是同一个动作的递进。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { defs, place } from '../build-cards.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const { getArt, TIER_NAMES } = require(path.join(ROOT, 'miniprogram/data/arts.js'));

const art = (process.argv[2] || '').trim();
if (!art) {
  console.error('用法：node tools/vendor/figures/_contact.mjs <artId>  例：squat');
  process.exit(1);
}
const figName = 'fig' + art[0].toUpperCase() + art.slice(1);
// 俯卧撑的十式图还在 build-cards.mjs 里（历史原因），其余五艺各自一个模块
// 注意：绝对 Windows 路径必须转成 file:// URL，否则 Node 报 ERR_UNSUPPORTED_ESM_URL_SCHEME（Windows 上踩过）
const mod = art === 'pushup'
  ? await import('../build-cards.mjs')
  : await import(pathToFileURL(path.join(HERE, `${art}.mjs`)).href);
const fig = mod[figName];
if (typeof fig !== 'function') {
  console.error(`✗ ${art}.mjs 里没有导出 ${figName}()（约定：fig<Art>(no)，no = 1..10）`);
  process.exit(1);
}
const meta = getArt(art);
if (!meta) { console.error(`✗ data/arts.js 里没有 ${art}`); process.exit(1); }

const CELL_W = 420, CELL_H = 250, PAD = 14, COLS = 2;
const rows = Math.ceil(meta.steps.length / COLS);
const W = CELL_W * COLS, H = CELL_H * rows;

const body = [];
for (const step of meta.steps) {
  const i = step.no - 1;
  const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H;
  let inner, tag = '';
  try {
    const r = fig(step.no);
    inner = place(r.parts, { x: x + PAD, y: y + PAD + 34, w: CELL_W - PAD * 2, h: CELL_H - PAD * 2 - 34 }, 4, r.extra);
    tag = r.tag ? ` · ${r.tag}` : '';
  } catch (e) {
    inner = `<text x="${x + 20}" y="${y + 60}" font-size="14" fill="#dc2626">第 ${step.no} 式画不出来：${String(e.message).slice(0, 40)}</text>`;
  }
  body.push(`<rect x="${x + 4}" y="${y + 4}" width="${CELL_W - 8}" height="${CELL_H - 8}" rx="8" fill="#ffffff" stroke="#e2e8f0"/>`);
  body.push(`<text x="${x + PAD}" y="${y + 24}" font-size="15" font-weight="700" fill="#111827">${step.no}. ${step.name}</text>`);
  body.push(`<text x="${x + PAD}" y="${y + 42}" font-size="11" fill="#94a3b8">${step.std.map((s, k) => TIER_NAMES[k] + ' ' + s).join(' · ')}${tag}</text>`);
  body.push(inner);
}

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`,
  ` font-family="'Segoe UI','Microsoft YaHei',sans-serif">`,
  defs(false),
  `<rect width="${W}" height="${H}" fill="#f8fafc"/>`,
  body.join('\n'),
  '</svg>'
].join('\n');

const svgPath = path.join(os.tmpdir(), `fig-${art}.svg`);
const pngPath = path.join(os.tmpdir(), `fig-${art}.png`);
fs.writeFileSync(svgPath, svg, 'utf8');

const chrome = [
  process.env.CHROME_PATH,
  'C:/Users/suojianfei/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });
if (!chrome) { console.error('没找到 Chrome/Edge，请设置 CHROME_PATH'); process.exit(1); }

// 每个艺用独立的 user-data-dir：多个 agent 并行跑联排时共用同一个目录会冲突
// （Chrome 报 status 21 / 拿不到锁）。加上 art 名 + 进程号，彻底避免撞车。
const profileDir = path.join(os.tmpdir(), `.chrome-fig-${art}-${process.pid}`);
execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1', '--default-background-color=ffffffff',
  `--window-size=${W},${H}`, `--user-data-dir=${profileDir}`,
  `--screenshot=${pngPath}`, 'file:///' + svgPath.replace(/\\/g, '/')
], { stdio: 'ignore' });
fs.rmSync(profileDir, { recursive: true, force: true });

console.log(`${art} 联排已生成：${pngPath}  (${W}×${H})`);
console.log('→ 用 read_image 看这张图，逐格确认姿势像不像、脚有没有站在地上、比例是否一致');
