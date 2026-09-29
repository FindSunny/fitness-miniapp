/**
 * E2E 共用工具：连接自动化服务、等待、断言
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const automator = require('miniprogram-automator');

const ROOT = path.resolve(__dirname, '..');
const AUTO_PORT = Number(process.env.E2E_PORT || 9420);
const WS = process.env.E2E_WS || `ws://127.0.0.1:${AUTO_PORT}`;
const CLI = [
  process.env.WECHAT_DEVTOOLS_CLI,
  'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat',
  'C:/Program Files/Tencent/微信web开发者工具/cli.bat'
].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 连接自动化服务；连不上就用 cli auto 拉起来再连。
 * 注意：不用 automator.launch()，它在 Windows 上执行 cli.bat 会失败
 * （"Failed to launch wechat web DevTools"）。
 */
async function getMiniProgram({ quiet = false } = {}) {
  const log = m => { if (!quiet) console.log(m); };
  try {
    const mp = await automator.connect({ wsEndpoint: WS });
    log(`→ 已连接现有自动化服务 ${WS}`);
    return mp;
  } catch (e) {
    log(`→ 没有可用的自动化服务（${e.message}），正在启动…`);
  }
  if (!CLI) throw new Error('没找到微信开发者工具 CLI，请设置 WECHAT_DEVTOOLS_CLI');

  const args = ['auto', '--project', ROOT, '--auto-port', String(AUTO_PORT)];
  const ps = `& ${JSON.stringify(CLI)} ${args.map(a => JSON.stringify(a)).join(' ')}`;
  log('→ 正在执行 cli auto 启动自动化服务（输出如下）…');
  // stdio: 'inherit' —— 既能把 CLI 的输出直接显示出来（便于看报错），
  // 也避开了"捕获子进程输出需要命名管道"的限制
  const code = await new Promise(resolve => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
    child.on('close', c => resolve(c));
    child.on('error', () => resolve(-1));
  });
  log(`→ cli auto 退出码 ${code}，等待自动化服务就绪…`);

  const t0 = Date.now();
  let lastErr;
  while (Date.now() - t0 < 120000) {
    await sleep(3000);
    try {
      const mp = await automator.connect({ wsEndpoint: WS });
      log(`→ 自动化服务已就绪（等待 ${Math.round((Date.now() - t0) / 1000)}s）`);
      return mp;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`连不上自动化服务 ${WS}：${lastErr && lastErr.message}\n` +
    '  请确认：开发者工具已登录、设置 → 安全设置 → 服务端口 已开启；\n' +
    '  必要时手动执行：cli auto --project <项目路径> --auto-port 9420');
}

/** 重试执行（页面切换期间 currentPage/data 可能短暂失败） */
async function retry(fn, tries = 4, delay = 500) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await sleep(delay); }
  }
  throw lastErr;
}

/** 等页面跳到目标路径（页面切换中出错会自动重试） */
async function waitForPage(mp, pathPart, timeout = 8000) {
  const t0 = Date.now();
  let cur = null;
  while (Date.now() - t0 < timeout) {
    try {
      cur = await mp.currentPage();
      if (cur && cur.path.indexOf(pathPart) >= 0) {
        await sleep(300);            // 给页面 onShow/渲染一点时间
        return await retry(() => mp.currentPage(), 3, 300);
      }
    } catch (e) { /* 切换中，继续等 */ }
    await sleep(300);
  }
  return cur;
}

/** 点击元素：先滚动到可见区域，点完等页面变化（真实点击） */
async function tapAndWait(mp, element, pathPart, timeout = 6000) {
  try {
    const off = await element.offset();
    const info = await mp.systemInfo();
    const h = (info && (info.windowHeight || info.screenHeight)) || 0;
    if (off && h && Number(off.top) > h - 80) {
      await mp.pageScrollTo(Math.max(0, Number(off.top) - 120));
      await sleep(400);
    }
  } catch (e) { /* 取不到位置就直接点 */ }
  await element.tap();
  return await waitForPage(mp, pathPart, timeout);
}

/**
 * 等小程序 App 真正就绪（刚拉起自动化服务时，窗口/首页还没渲染完，
 * 此时调 reLaunch 会报 "getPageMetaByWebviewId(...) is null"）
 */
async function waitReady(mp, timeout = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const p = await mp.currentPage();
      if (p && p.path) {
        await sleep(1000);           // 再给一点渲染时间
        return p.path;
      }
    } catch (e) { /* 还没准备好，继续等 */ }
    await sleep(1000);
  }
  return null;
}

module.exports = { ROOT, CLI, WS, AUTO_PORT, sleep, retry, getMiniProgram, waitForPage, tapAndWait, waitReady };
