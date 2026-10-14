/**
 * 真机冒烟（物理手机 · 最小验证）
 *
 * 目的：验证「物理手机 + 自动化通道」这条路通不通，不追求覆盖度。
 *   ① 连接：用 connect() 连自动化服务 → 发 Tool.enableRemoteDebug → 二维码存成 PNG → 手机扫码
 *   ② 探针：真机身份（platform/model）、storage、evaluate、mock、截图 五个通道能力
 *   ③ 旅程：首页 → 列表 → 详情记录 3 组 50 → 达标【升级】 → 第 2 式自动进行中（核心一条）
 *
 * 为什么不直接用 mp.remote()：
 *   它内部把二维码 turn 成终端 ASCII 码（qrcode-terminal），用户要对着终端扫，不方便；
 *   这里直接拿 Tool.enableRemoteDebug 返回的 qrCode（base64 PNG）存文件，用户打开图片扫码。
 *   事件等待逻辑与 SDK 源码 out/MiniProgram.js 的 remote() 一致（Tool.onRemoteDebugConnected）。
 *
 * 用法：
 *   1) npm run e2e:serve      # 已有自动化服务可跳过（脚本检测不到会自动拉起，约 30–90s）
 *   2) npm run e2e:remote     # 出二维码 → 手机微信扫码 → 自动跑完
 *
 * 手工模式（--manual，用于 iOS 等需要先在 GUI 里选平台的场景）：
 *   1) 在工具里打开「真机调试」弹窗 → 底部选平台（如「iOS 系统」）→ 手机扫码，确认连上
 *   2) npm run e2e:remote -- --manual     # 跳过出码，直接连上现有会话跑断言
 *
 * 平台支持（实测，2026-10-14）：
 *   Android 真机：可用（IN2010 / Android 12 / 微信 8.0.78 / 基础库 3.17.4，连续两轮 20/20）
 *   iOS 真机：可用，但**必须走手工模式**（iPhone 16 Pro / iOS 26.7 / 微信 8.0.79，18/18）。
 *     关键：工具「真机调试」弹窗里选的平台必须与设备匹配（选「iOS 系统」再出码）。
 *     踩过：iOS 手机扫了 Android 平台的码（SDK 出码默认 Android）→ 连接事件会触发
 *     但首条命令 timeout，曾被误判为「iOS 不支持」。
 *
 * 前提：手机微信的基础库 ≥ 2.7.3，且该微信号有本小程序的开发权限。
 */
const fs = require('fs');
const path = require('path');
const { getMiniProgram, sleep, waitForPage, retry, waitReady } = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const QR_PATH = path.join(ROOT, 'e2e', 'remote-qr.png');
const SHOT_PATH = path.join(ROOT, 'e2e', 'remote-shot.png');
const STORAGE_KEY = 'cf_state_v1';
const SCAN_TIMEOUT = 240000;   // 等扫码超时（4 分钟）
const MANUAL = process.argv.includes('--manual');   // 手工模式：跳过出码，连已有真机会话

const results = [];
let scenario = '(启动)';
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : '   ← ' + detail}`);
}
function step(title) { scenario = title; console.log(`\n▸ ${title}`); }
function note(line) { console.log(`  · ${line}`); }

/* ---- 与 run.js 同款：用真实事件处理函数驱动页面（导航/wx API 全真） ---- */
async function fire(mp, method, event, wantPath) {
  return await mp.evaluate(function (m, ev, want) {
    const pages = getCurrentPages();
    let cur = pages[pages.length - 1];
    if (want) {
      for (let i = pages.length - 1; i >= 0; i--) {
        if ((pages[i].route || '').indexOf(want) >= 0) { cur = pages[i]; break; }
      }
    }
    if (!cur) throw new Error('拿不到页面实例');
    if (typeof cur[m] !== 'function') throw new Error('页面 ' + (cur.route || '?') + ' 上没有方法 ' + m);
    return cur[m](ev);
  }, method, event || {}, wantPath || '');
}
async function setPageData(mp, patch) {
  return await retry(async () => {
    const p = await mp.currentPage();
    if (!p) throw new Error('拿不到当前页面实例');
    await p.data();
    return await p.setData(patch);
  }, 5, 500);
}
async function readData(mp, expectPath, tries = 4) {
  if (expectPath) await waitForPage(mp, expectPath, 6000);
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const p = await mp.currentPage();
      if (p && (!expectPath || p.path.indexOf(expectPath) >= 0)) return await p.data();
      lastErr = new Error(`栈顶页面是 ${p && p.path}，期望 ${expectPath}`);
    } catch (e) { lastErr = e; }
    await sleep(500);
  }
  throw lastErr || new Error('读不到页面数据');
}
async function queryAll(mp, sel) {
  const p = await mp.currentPage();
  return p ? await p.$$(sel) : [];
}
async function recordSet(mp, value) {
  await waitForPage(mp, 'pages/step/step', 6000).catch(() => {});
  try {
    await setPageData(mp, { input: String(value) });
    await fire(mp, 'addSet', {}, 'step/step');
  } catch (e) {
    await sleep(900);
    await waitForPage(mp, 'pages/step/step', 6000).catch(() => {});
    await setPageData(mp, { input: String(value) });
    await fire(mp, 'addSet', {}, 'step/step');
  }
  await sleep(250);
}

(async () => {
  console.log('→ 连接自动化服务（连不上会自动 cli auto 拉起工具，约 30–90s）…');
  const mp = await getMiniProgram();
  const readyPath = await waitReady(mp);
  console.log(`→ 工具侧 App 就绪（当前页 ${readyPath || '未知'}）`);

  try {
    // ============================================================ 0. 连接真机
    if (MANUAL) {
      step('手工模式：跳过出码（假定已在工具 GUI 完成真机调试）');
      note('若探针的 platform 仍是 devtools，说明手工真机会话没有桥接到自动化通道');
    } else {
      step('真机连接：生成二维码 → 手机扫码');
      const { qrCode } = await mp.send('Tool.enableRemoteDebug', { auto: false });
      if (!qrCode) throw new Error('Tool.enableRemoteDebug 没有返回二维码（工具版本可能不支持真机自动化）');
      fs.writeFileSync(QR_PATH, Buffer.from(qrCode, 'base64'));
      check('二维码已生成（PNG 文件）', fs.existsSync(QR_PATH) && fs.statSync(QR_PATH).size > 0, QR_PATH);

      console.log('\n' + '='.repeat(52));
      console.log('  请打开这张图，用手机微信「扫一扫」：');
      console.log('  ' + QR_PATH);
      console.log('  （微信号需有本小程序的开发权限；二维码有时效，过期重跑本脚本）');
      console.log('='.repeat(52) + '\n');

      const t0 = Date.now();
      const connected = new Promise(resolve => {
        mp.connection.once('Tool.onRemoteDebugConnected', async () => {
          await sleep(1500);
          resolve(true);
        });
      });
      const timeout = sleep(SCAN_TIMEOUT).then(() => false);
      const scanned = await Promise.race([connected, timeout]);
      check(`扫码连接成功（等待 ${Math.round((Date.now() - t0) / 1000)}s）`, scanned,
        scanned ? '' : `等 ${SCAN_TIMEOUT / 1000}s 未扫码（二维码可能已过期，重跑一次）`);
      if (!scanned) throw new Error('扫码超时，冒烟终止');
    }

    await waitReady(mp);   // 真机侧 AppService 就绪

    // 探针：真机身份 / storage / evaluate / mock / 截图
    step('探针：真机身份 / storage / evaluate / mock / 截图');
    let sys;
    try {
      sys = await mp.systemInfo();
    } catch (e) {
      // 实测边界：iOS 设备扫码后，Tool.onRemoteDebugConnected 会触发（连接看似成功），
      // 但自动化命令通道不通 —— 首条命令就在这里 timeout。给下一次跑的人一个明确指引。
      throw new Error('真机命令通道无响应（' + ((e && e.message) || e) + '）。\n' +
        '    已知边界：iOS 设备扫码会出现此现象（连接成功但自动化命令不通）；\n' +
        '    本方案实测仅 Android 可用 —— 请改用 Android 手机重新扫码。');
    }
    check('运行环境是真机（platform 非 devtools）',
      sys && sys.platform !== 'devtools',
      `platform=${sys && sys.platform} model=${sys && sys.model} system=${sys && sys.system}`);
    note(`systemInfo：platform=${sys.platform} · model=${sys.model} · ${sys.system} · SDKVersion=${sys.SDKVersion} · 微信 ${sys.version}`);

    await mp.callWxMethod('setStorageSync', '__smoke_probe', { t: 123 });
    const back = await mp.callWxMethod('getStorageSync', '__smoke_probe');
    check('storage 通道可读写', !!(back && back.t === 123), JSON.stringify(back));
    await mp.callWxMethod('removeStorageSync', '__smoke_probe').catch(() => {});

    const two = await mp.evaluate(() => 1 + 1);
    check('evaluate 通道可用', two === 2, String(two));

    // mock 能力探测：mock 成真实内容 + 探针字段 → 读回验证 → 再 mock 回完整真实对象
    let mockEffective = false;
    try {
      await mp.mockWxMethod('getSystemInfoSync', Object.assign({}, sys, { __smoke: 'MOCK-ON' }));
      const probe = await mp.callWxMethod('getSystemInfoSync');
      mockEffective = !!(probe && probe.__smoke === 'MOCK-ON');
      await mp.mockWxMethod('getSystemInfoSync', sys);   // 还原成"真实内容"，避免页面拿到残缺对象
    } catch (e) { note('mock 探测异常：' + (e && e.message)); }
    check('mockWxMethod 可用且生效（能力探测）', mockEffective,
      mockEffective ? '' : '不可用 —— 后续 finish 达标步骤将自动跳过');

    let shotOk = false;
    try {
      await mp.screenshot({ path: SHOT_PATH });
      shotOk = fs.existsSync(SHOT_PATH) && fs.statSync(SHOT_PATH).size > 15000;
    } catch (e) { /* 真机截图不支持属正常，仅报告 */ }
    note(`screenshot ${shotOk ? '可用 → ' + SHOT_PATH : '不可用（真机常见，不影响断言）'}`);

    // ============================================================ 2. 旅程：全新用户 → 记录 → 达标 → 解锁
    step('旅程：首页推荐 → 列表三态');
    await mp.callWxMethod('clearStorageSync');
    let page = await retry(() => mp.reLaunch('/pages/index/index'), 3, 1500);
    await sleep(1200);
    let data = await readData(mp, 'pages/index/index');
    check('首页推荐指向 俯卧撑 第 1 式',
      data.main && data.main.artId === 'pushup' && data.main.no === 1, JSON.stringify(data.main));
    check('全新用户看到「开始训练」', data.main && data.main.title === '开始训练', data.main && data.main.title);
    check('六艺卡片渲染 6 张（渲染通道）', (await queryAll(mp, '.art-card')).length === 6);

    await fire(mp, 'goArt', { currentTarget: { dataset: { id: 'pushup' } } }, 'index/index');
    await waitForPage(mp, 'pages/art/art');
    data = await readData(mp, 'pages/art/art');
    check('列表：第 1 式 = 进行中', data.steps[0].state === 'current', JSON.stringify(data.steps[0]).slice(0, 80));
    check('列表：第 2–10 式 = 未解锁（锁定式推进）',
      data.steps.slice(1).every(s => s.state === 'locked'),
      data.steps.slice(1).map(s => s.stateText).join(','));
    check('列表渲染 10 行', (await queryAll(mp, '.step-item')).length === 10);

    step('旅程：详情 → 记录 3 组 50 → 达标【升级】');
    await fire(mp, 'goStep', { currentTarget: { dataset: { no: 1 } } }, 'art/art');
    await waitForPage(mp, 'pages/step/step');
    await sleep(800);
    data = await readData(mp, 'pages/step/step');
    check('详情页 = 墙壁俯卧撑', data.step && data.step.name === '墙壁俯卧撑', data.step && data.step.name);
    check('三档标准 = 1×10 / 2×25 / 3×50',
      data.tiers.map(t => t.text).join('|') === '1 组 × 10次|2 组 × 25次|3 组 × 50次',
      data.tiers.map(t => t.text).join('|'));

    for (const v of [50, 50, 50]) await recordSet(mp, v);
    data = await readData(mp, 'pages/step/step');
    check('记录 3 组成功（setData + addSet 通道）', data.values.length === 3, JSON.stringify(data.values));
    check('判定【升级】且可进入下一式',
      data.result.tier === '升级' && data.result.canAdvance === true,
      `tier=${data.result.tier} canAdvance=${data.result.canAdvance}`);

    if (mockEffective) {
      step('旅程：finish 达标 → 写入存储 → 第 2 式自动进行中（核心回归）');
      await mp.mockWxMethod('showModal', { confirm: false, cancel: true });   // 模拟点「留在本式」
      fire(mp, 'finish', {}, 'step/step').catch(() => {});
      await sleep(2500);
      const st = await retry(() => mp.callWxMethod('getStorageSync', STORAGE_KEY), 4, 800);
      check('达标已写入存储（这一式已通过）', !!(st && st.steps && st.steps['pushup-01']),
        JSON.stringify((st && st.steps) || {}));
      check('训练记录已落库', (st.sessions || []).length === 1, `sessions=${(st.sessions || []).length}`);

      const artPage = await mp.reLaunch('/pages/art/art?artId=pushup');
      await artPage.waitFor(900);
      const artData = await readData(mp, 'pages/art/art');
      check('核心回归：第 1 式已通过 + 第 2 式自动进行中',
        artData.steps[0].state === 'passed' && artData.steps[1].state === 'current',
        artData.steps.slice(0, 3).map(s => s.no + ':' + s.stateText).join(' | '));
    } else {
      note('⚠ mock 不可用：finish 达标链路（写入存储 / 解锁下一式）已跳过');
      note('  改用 seed 造态验证「列表三态渲染」这一半链路');
      await mp.callWxMethod('setStorageSync', STORAGE_KEY, {
        version: 2, arts: {}, sessions: [], drafts: {},
        steps: { 'pushup-01': { passedAt: Date.now() } }
      });
      const artPage = await mp.reLaunch('/pages/art/art?artId=pushup');
      await artPage.waitFor(900);
      const artData = await readData(mp, 'pages/art/art');
      check('（seed 造态）第 1 式已通过 + 第 2 式进行中（渲染层）',
        artData.steps[0].state === 'passed' && artData.steps[1].state === 'current',
        artData.steps.slice(0, 3).map(s => s.no + ':' + s.stateText).join(' | '));
    }

    // ============================================================ 3. 收尾
    step('收尾：还原全新用户');
    await mp.callWxMethod('clearStorageSync');
    page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(700);
    data = await readData(mp, 'pages/index/index');
    check('已还原：推荐回到俯卧撑第 1 式', data.main && data.main.artId === 'pushup' && data.main.no === 1);
  } catch (e) {
    check(`场景「${scenario}」执行完成`, false, (e && e.message) || String(e));
    console.error(`\n✗ 场景「${scenario}」出错：${e && e.message}`);
  } finally {
    await mp.close().catch(() => {});
  }

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`真机冒烟：${pass} / ${results.length} 通过`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(f => console.log(`  ✗ ${f.name}  ← ${f.detail}`));
  }
  console.log(`\n产物：二维码 e2e/remote-qr.png ｜ 截图 ${fs.existsSync(SHOT_PATH) ? 'e2e/remote-shot.png' : '（未生成）'}`);
  process.exit(failed.length ? 1 : 0);
})();
