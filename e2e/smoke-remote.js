/**
 * 真机冒烟（物理手机 · 最小验证）
 *
 * 目的：验证「物理手机 + 自动化通道」这条路通不通，不追求覆盖度。
 *   ① 连接：默认「引导式」—— 你在开发者工具里完成真机调试（选平台 + 扫码），
 *      脚本每 4 秒探测一次真机会话，连上后自动开跑（Android / iOS 通用）
 *   ② 探针：真机身份（platform/model）、storage、evaluate、mock、截图 五个通道能力
 *   ③ 旅程：首页 → 列表 → 详情记录 3 组 50 → 达标【升级】 → 第 2 式自动进行中（核心一条）
 *
 * 为什么默认引导式（而不是脚本出码）：
 *   真机调试二维码按平台生成，工具的「平台选择」会被持久记忆（上次测 iOS、这次默认还是 iOS）；
 *   脚本出码沿用的是工具当前选择——设备与码平台不匹配时会出现「假连接」：
 *   扫码后连接事件触发，但自动化命令全部超时（曾把 iOS 误判成「不支持」）。
 *   引导式把「选平台」交给你在弹窗里现场操作，所见即所得，从机制上绕开这个问题。
 *
 * 用法：
 *   1) npm run e2e:serve      # 已有自动化服务可跳过（脚本检测不到会自动拉起，约 30–90s）
 *   2) npm run e2e:remote     # 默认引导式：打印操作清单 → 你在工具里连真机 → 自动检测后跑完
 *
 *   可选：--auto 免扫码推送（2026-10-14 实测成立）——脚本直接推送到设备，工具会自动
 *   打开手机上的小程序并建立调试会话（Tool.enableRemoteDebug {auto:true}，返回 {} 无码）。
 *   **前提：手机上未打开本项目的小程序**（挂着会推不进来，连接事件不触发）；
 *   且设备此前至少扫码连接过一次（已建立调试信任）。推送成功后手机上会自动打开小程序。
 *   可选：--qr 走「脚本出码」模式（二维码存 e2e/remote-qr.png 供扫码；
 *   不用 mp.remote() 是因为它把码打到终端 ASCII，扫码不方便，这里存成 PNG）；
 *   仅当确认「工具当前平台选择 = 目标手机平台」时使用，否则会假连接。
 *   （原 --manual 已并入默认的引导式行为，不需要再传。）
 *
 * 平台支持（实测 2026-10-14）：
 *   Android：IN2010 / Android 12 / 微信 8.0.78 / 基础库 3.17.4 —— 20/20（连续两轮）
 *   iOS：iPhone 16 Pro / iOS 26.7 / 微信 8.0.79 —— 18/18（引导式路径）
 *   两个平台五个通道（systemInfo/storage/evaluate/mockWxMethod/screenshot）都可用。
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
const WAIT_TIMEOUT = 300000;   // [引导式] 等真机会话就绪超时（5 分钟）
const SCAN_TIMEOUT = 240000;   // [--qr] 等扫码超时（4 分钟）
const AUTO_TIMEOUT = 60000;    // [--auto] 等推送连接事件超时（1 分钟）
const USE_AUTO = process.argv.includes('--auto');   // 免扫码推送模式（优先于 --qr）
const USE_QR = process.argv.includes('--qr');       // 脚本出码模式（默认是引导式）

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

/**
 * 引导式等待：轮询探测真机会话是否已就绪（platform 从 devtools 变为 ios/android）
 * 期间打印心跳，让等待可感知；检测到即返回 systemInfo，超时返回 null。
 */
async function waitForRemoteDevice(mp, timeoutMs) {
  console.log('\n' + '='.repeat(58));
  console.log('  请在开发者工具中操作：');
  console.log('    ① 点工具栏「真机调试」');
  console.log('    ② 弹窗底部选平台（与你的手机匹配：Android/鸿蒙 或 iOS 系统）');
  console.log('    ③ 手机微信扫码（需有本小程序的开发权限）');
  console.log('  脚本每 4 秒自动检测，连上后立即开始断言 —— 不需要你回来汇报。');
  console.log('='.repeat(58) + '\n');

  const t0 = Date.now();
  let lastBeat = -8;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const s = await mp.systemInfo();
      if (s && s.platform && s.platform !== 'devtools') return s;
    } catch (e) { /* 会话切换间隙偶发报错，忽略继续等 */ }
    const waited = Math.floor((Date.now() - t0) / 1000);
    if (waited - lastBeat >= 8) {
      lastBeat = waited;
      console.log(`  … 仍在等待真机会话（已等 ${waited}s）—— 若已扫码却一直停在这，检查弹窗里选的平台与手机是否一致`);
    }
    await sleep(4000);
  }
  return null;
}

(async () => {
  console.log('→ 连接自动化服务（连不上会自动 cli auto 拉起工具，约 30–90s）…');
  const mp = await getMiniProgram();
  // 就绪等待给 30s 就够（出现过工具中间态拖满 90s 的情况；后续各步自带重试兜底）
  const readyPath = await waitReady(mp, 30000);
  console.log(`→ 工具侧 App 就绪（当前页 ${readyPath || '未知'}）`);

  let sys = null;
  try {
    // 跑前卫生：--auto / --qr 先清掉可能残留的调试会话（上一轮异常退出时可能留下，
    // 留着会阻塞推送/扫码——踩过：残留会话导致「推送事件触发但目标不切换到真机」）。
    // 引导式不能这么做：它的前提就是用户已在 GUI 里连好了会话。
    if (USE_AUTO || USE_QR) {
      await mp.send('Tool.resetRemoteDebug').catch(() => {});
      await sleep(800);
    }

    // ============================================================ 0. 连接真机
    if (USE_AUTO) {
      step('连接（--auto）：免扫码推送到设备');
      console.log('  → 推送中……（前提：手机上未打开本项目的小程序；若超时请关掉小程序后重跑）');
      const t0 = Date.now();
      const connected = new Promise(resolve => {
        mp.connection.once('Tool.onRemoteDebugConnected', async () => {
          await sleep(1500);
          resolve(true);
        });
      });
      await mp.send('Tool.enableRemoteDebug', { auto: true });   // 返回 {}（无码）
      const ok = await Promise.race([connected, sleep(AUTO_TIMEOUT).then(() => false)]);
      check(`免扫码推送成功（等待 ${Math.round((Date.now() - t0) / 1000)}s）`, ok,
        ok ? '' : '未连上 —— 最常见原因：手机端还开着本项目的小程序（关掉后重跑）；也可能是设备的调试信任已过期（用引导式扫码一次即可续期）');
      if (!ok) throw new Error('auto 推送超时，冒烟终止');
      await waitReady(mp);   // 真机侧 AppService 就绪
    } else if (USE_QR) {
      step('连接（--qr）：脚本出码 → 手机扫码');
      const { qrCode } = await mp.send('Tool.enableRemoteDebug', { auto: false });
      if (!qrCode) throw new Error('Tool.enableRemoteDebug 没有返回二维码（工具版本可能不支持真机自动化）');
      fs.writeFileSync(QR_PATH, Buffer.from(qrCode, 'base64'));
      check('二维码已生成（PNG 文件）', fs.existsSync(QR_PATH) && fs.statSync(QR_PATH).size > 0, QR_PATH);

      console.log('\n' + '='.repeat(52));
      console.log('  请打开这张图，用手机微信「扫一扫」：');
      console.log('  ' + QR_PATH);
      console.log('  （平台必须与手机匹配；二维码有时效，过期重跑本脚本）');
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
      await waitReady(mp);   // 真机侧 AppService 就绪
    } else {
      step('连接（引导式）：等你在工具里完成真机调试');
      const t0 = Date.now();
      sys = await waitForRemoteDevice(mp, WAIT_TIMEOUT);
      check(`检测到真机会话（等待 ${Math.round((Date.now() - t0) / 1000)}s）`, !!sys,
        '超时未检测到 —— 排查：① 工具里点了「真机调试」吗 ② 手机扫码了吗 ③ 弹窗平台与手机是否一致');
      if (!sys) throw new Error('等真机会话超时，冒烟终止');
      note(`真机就绪：${sys.model} · ${sys.system}`);
    }

    // 探针：真机身份 / storage / evaluate / mock / 截图
    step('探针：真机身份 / storage / evaluate / mock / 截图');
    if (!sys) {
      try {
        sys = await mp.systemInfo();
      } catch (e) {
        // 首条命令 timeout = 通道级故障。最常见的根因是「二维码平台与设备不匹配」，
        // 而不是平台不支持（踩过：曾把 iOS 扫 Android 码误判成「iOS 不支持」）。
        throw new Error('真机命令通道无响应（' + ((e && e.message) || e) + '）。\n' +
          '    最常见原因：二维码/弹窗平台与手机不匹配（工具会记住上次的平台选择）。\n' +
          '    请核对「真机调试」弹窗里的平台（Android 手机→Android/鸿蒙；iOS→iOS 系统）后重跑。');
      }
    }
    check('运行环境是真机（platform 非 devtools）',
      sys && sys.platform !== 'devtools',
      `platform=${sys && sys.platform} model=${sys && sys.model} system=${sys && sys.system}`);
    if (!sys || sys.platform === 'devtools') {
      // 快速失败：推送/扫码看似成功但目标没切到真机（踩过：残留会话下平台仍是 devtools，
      // 整轮会静默跑在模拟器上；断言能抓到，但没必要浪费旅程阶段的多次 reLaunch）。
      throw new Error('自动化目标不是真机（platform=' + (sys && sys.platform) + '）——' +
        '推送/扫码看似成功但目标未切换到真机。常见原因：手机端小程序开着、或工具里有残留调试会话。' +
        '请关掉手机上的小程序后重跑（脚本已自动做过会话 reset）。');
    }
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
    // 收尾顺序（每一步都有踩坑背景，别调换）：
    // ① App.exit 必须最先发——让真机上的小程序退出。必须趁调试通道还活着，
    //    否则命令送不到手机（踩过：先 reset 再 close，手机上小程序一直开着不关）。
    // ② Tool.resetRemoteDebug 关闭工具的调试会话（destroy + forceQuitRoom）——
    //    残留会话会阻塞下一轮连接/推送（症状：一直等待、或推送成功但目标不切换）。
    // ③ Tool.close + disconnect 结束自动化会话（等价 mp.close 的后半段）。
    try { await mp.send('App.exit'); } catch (e) { /* 真机可能已断，忽略 */ }
    await sleep(1000);
    await mp.send('Tool.resetRemoteDebug').catch(() => {});
    await mp.send('Tool.close').catch(() => {});
    try { mp.disconnect(); } catch (e) { /* 忽略 */ }
  }

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`真机冒烟：${pass} / ${results.length} 通过`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(f => console.log(`  ✗ ${f.name}  ← ${f.detail}`));
  }
  console.log(`\n产物：${USE_QR ? '二维码 e2e/remote-qr.png ｜ ' : ''}截图 ${fs.existsSync(SHOT_PATH) ? 'e2e/remote-shot.png' : '（未生成）'}`);
  process.exit(failed.length ? 1 : 0);
})();
