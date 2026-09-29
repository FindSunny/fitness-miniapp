/**
 * 小程序端到端测试（连真实小程序运行环境）
 *
 * 设计（A 方案）：
 *   交互用「调用真实事件处理函数」触发（evaluate + getCurrentPages），
 *   不用 element.tap()/page.callMethod() —— 前者坐标点不到，后者取不到页面方法。
 *   导航、wx API、storage 写入全是真实的；元素查询用于「渲染断言」，并每步截图。
 *
 * 用法：
 *   1) npm run e2e:serve     # 起自动化服务（看到 √ auto）
 *   2) npm run e2e           # 跑断言 + 出截图（e2e/shots/）
 */
const fs = require('fs');
const path = require('path');
const { getMiniProgram, sleep, waitForPage, retry, waitReady } = require('./lib');

const SHOTS = path.join(__dirname, 'shots');
const STORAGE_KEY = 'cf_state_v1';
// 期望的断言条数：用来发现"中途崩了但显示全部通过"
// （每次增删断言都要改这个数——它是这道保险的代价，值得）
const EXPECTED_CHECKS = 85;
const results = [];
let shotIndex = 0;
let scenario = '(启动)';

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : '   ← ' + detail}`);
}
function step(title) { scenario = title; console.log(`\n▸ ${title}`); }

// 截图默认关闭：开发者工具的 screenshot 在窗口被遮挡/后台时容易失败，
// 且失败后会影响页面栈。需要证据图时用 E2E_SHOTS=1 npm run e2e
const WITH_SHOTS = process.env.E2E_SHOTS === '1';

async function shot(mp, name) {
  if (!WITH_SHOTS) return;
  shotIndex++;
  const file = path.join(SHOTS, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
  try {
    const r = await mp.screenshot({ path: file });
    if (!fs.existsSync(file) && r) fs.writeFileSync(file, r, 'base64');
  } catch (e) { /* 截图失败不影响断言 */ }
}

const seed = (mp, state) => mp.callWxMethod('setStorageSync', STORAGE_KEY, state);
const readState = mp => mp.callWxMethod('getStorageSync', STORAGE_KEY);

/**
 * 触发真实事件处理函数（等价于用户操作，只是不经过坐标点击）
 * @param wantPath 可选：指定目标页面路径片段。页面栈有偏差时（例如某次调用异常后
 *                 栈顶变成别的页面）能精准找到目标页，而不是盲目用栈顶。
 */
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
  // 用 SDK 自带的 setData（先取新的栈顶页面）。
  // 页面刚 reLaunch 完时节点可能还没就绪（DevTools 报 "page node not found"），
  // 所以先 data() 探一下再 setData，并整体重试。
  return await retry(async () => {
    const p = await mp.currentPage();
    if (!p) throw new Error('拿不到当前页面实例');
    await p.data();                 // 探针：节点失效会在这里抛错，交给 retry
    return await p.setData(patch);
  }, 5, 500);
}
/** 读栈顶页面的 data（可指定期望页面；页面栈漂移时先等它回来，避免读到别的页面） */
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
/** 在栈顶页面查元素 */
async function query(mp, sel) {
  const p = await mp.currentPage();
  return p ? await p.$(sel) : null;
}
async function queryAll(mp, sel) {
  const p = await mp.currentPage();
  return p ? await p.$$(sel) : [];
}
const textOf = async (mp, sel) => { const el = await query(mp, sel); return el ? await el.text() : null; };

/** 在详情页记录一组（页面切换/渲染中可能失败，重试一次） */
async function recordSet(mp, value) {
  // 先用"等页面就绪"做探针，再 setData —— 固定 sleep 不够稳（踩过 'page node not found'）
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
  fs.mkdirSync(SHOTS, { recursive: true });
  // 只在截图模式才清空截图目录：断言 pass 默认不写图，
  // 清空会把 e2e:shots 生成的证据图误删（踩过）
  if (WITH_SHOTS) fs.readdirSync(SHOTS).forEach(f => fs.rmSync(path.join(SHOTS, f), { force: true }));

  console.log('→ 连接小程序自动化服务…');
  const mp = await getMiniProgram();
  const readyPath = await waitReady(mp);
  console.log(`→ App 就绪（当前页 ${readyPath || '未知'}）`);

  try {
    // ============================================================ 1. 首页
    step('首页：推荐与六艺卡片');
    await mp.callWxMethod('clearStorageSync');
    let page = await retry(() => mp.reLaunch('/pages/index/index'), 3, 1500);
    await page.waitFor(900);
    let data = await readData(mp);

    check('推荐卡片指向 俯卧撑 第 1 式',
      data.main && data.main.artId === 'pushup' && data.main.no === 1, JSON.stringify(data.main));
    check('推荐文案说明了原因', /从俯卧撑开始/.test(data.main.reason || ''), data.main.reason);
    check('全新用户看到的是「开始训练」而不是「接着练」',
      data.main.title === '开始训练', data.main.title);
    check('六艺卡片渲染 6 张', (await queryAll(mp, '.art-card')).length === 6);
    check('六个进度条都存在', (await queryAll(mp, '.bar-in')).length === 6);
    check('俯卧撑显示"图 10/10"（回归：曾经 9/10）', data.arts[0].drawn === 10, String(data.arts[0].drawn));
    // ★ 真机验收回归：全新用户六个艺都显示"进行中"（根因：文案从"当前式"推出来，而不是从"动过没有"）
    check('全新用户六个艺都显示"未开始"',
      data.arts.every(a => a.stateText === '未开始'),
      data.arts.map(a => a.name + ':' + a.stateText).join(' · '));
    check('卡片状态文案够短（半个卡片宽不折行）',
      data.arts.every(a => a.stateText.length <= 5),
      data.arts.map(a => a.stateText).join(','));
    check('六艺十式图已全部画全（60 张）',
      data.arts.every(a => a.drawn === a.total),
      data.arts.map(a => a.id + ':' + a.drawn + '/' + a.total).join(' '));
    check('存储走的是真 storage（非内存降级）',
      data.storeInfo && data.storeInfo.backend === 'wx.storage', JSON.stringify(data.storeInfo));
    await shot(mp, 'home-fresh');

    // ============================================================ 2. 十式列表
    step('首页 → 俯卧撑十式列表（触发真实 goArt）');
    await fire(mp, 'goArt', { currentTarget: { dataset: { id: 'pushup' } } }, 'index/index');
    page = await waitForPage(mp, 'pages/art/art');
    check('跳到十式列表页', page.path === 'pages/art/art', page.path);
    data = await readData(mp);
    check('进度为 第 1 / 10 式', data.status.current === 1, String(data.status.current));
    check('第 1 式 = 进行中',
      data.steps[0].state === 'current' && data.steps[0].stateText === '进行中',
      JSON.stringify(data.steps[0]).slice(0, 80));
    check('第 2–10 式 = 未解锁（锁定式推进：不能跳级）',
      data.steps.slice(1).every(s => s.state === 'locked' && s.stateText === '未解锁'),
      data.steps.slice(1).map(s => s.stateText).join(','));
    check('列表渲染 10 行', (await queryAll(mp, '.step-item')).length === 10);
    check('表头进度条 0%', data.status.percent === 0, String(data.status.percent));
    await shot(mp, 'art-list');

    // ============================================================ 3. 详情页
    step('列表 → 墙壁俯卧撑详情（触发真实 goStep）');
    await fire(mp, 'goStep', { currentTarget: { dataset: { no: 1 } } }, 'art/art');
    page = await waitForPage(mp, 'pages/step/step');
    check('跳到详情页', page.path === 'pages/step/step', page.path);
    data = await readData(mp);
    check('动作名 = 墙壁俯卧撑', data.step.name === '墙壁俯卧撑', data.step.name);
    check('详情页顶部横幅说明"当前在练"', data.banner && data.banner.kind === 'current', JSON.stringify(data.banner));
    check('三档标准渲染 3 行', data.tiers.length === 3, String(data.tiers.length));
    check('标准文案 = 初级 1×10 / 中级 2×25 / 升级 3×50',
      data.tiers.map(t => t.text).join('|') === '1 组 × 10次|2 组 × 25次|3 组 × 50次',
      data.tiers.map(t => t.text).join('|'));
    const pose = await query(mp, '.pose');
    check('示意图已渲染', !!pose);
    check('图指向 mov-pushup-01', pose ? /mov-pushup-01\.png$/.test(await pose.attribute('src')) : false);
    check('示意图按比例占满宽度（mode=widthFix，不再被固定高度压小）',
      pose ? (await pose.attribute('mode')) === 'widthFix' : false,
      pose ? await pose.attribute('mode') : 'no .pose');
    check('示意图上有"点击看大图"提示', /点击看大图/.test((await textOf(mp, '.zoom-tag')) || ''));

    // 点示意图 → 全屏大图（新交互，必须有真机断言）
    await fire(mp, 'openPose', {}, 'step/step');
    await sleep(800);
    check('点示意图打开全屏大图', !!(await query(mp, '.lightbox')));
    check('大图里真的渲染了图片', !!(await query(mp, '.lightbox-img')));
    await shot(mp, 'step-pose-big');
    await fire(mp, 'closePose', {}, 'step/step');
    await sleep(600);
    check('再点一下关闭大图（遮罩消失）', !(await query(mp, '.lightbox')));
    await shot(mp, 'step-wall');

    // ============================================================ 4. 记录 + 判定
    step('记录两组 25 次 → 看判定文案');
    page = await mp.reLaunch('/pages/step/step?artId=pushup&no=1');
    await page.waitFor(900);
    await recordSet(mp, 25);
    await recordSet(mp, 25);
    data = await readData(mp, 'pages/step/step');
    check('记录了两组', data.values.length === 2, JSON.stringify(data.values));
    check('判定为【中级】', data.result.tier === '中级', String(data.result.tier));
    check('算出"还差 3 组 × 50次"', /还差 3 组 × 50次/.test(data.gapText || ''), data.gapText);
    check('页面上真的显示了这句（渲染层）', /还差/.test((await textOf(mp, '.verdict')) || ''));
    await shot(mp, 'step-verdict');

    // ============================================================ 5. 达标 → 解锁下一式
    step('做满升级标准 → 弹达标框 → 下一式自动解锁（回归：访谈发现"达标后列表里没有进行中"）');
    page = await mp.reLaunch('/pages/step/step?artId=pushup&no=1');
    await page.waitFor(900);
    // 关键：finish() 达标后会 redirectTo。若让它真跳，页面会在 evaluate 返回前被销毁，
    // 导致 "timeout waiting for automator response"。所以把跳转 mock 掉并在运行时记录 URL，
    // 这样既不销毁页面，又能断言"它确实准备跳到哪里"。
    // confirm:false = 用户点「留在本式」——正是访谈里出问题的那条路。
    await mp.mockWxMethod('showModal', { confirm: false, cancel: true });
    await mp.mockWxMethod('redirectTo', function (options) {
      globalThis.__lastRedirect = options && options.url;
    });
    for (const v of [50, 50, 50]) await recordSet(mp, v);
    data = await readData(mp, 'pages/step/step');
    check('达成【升级】', data.result.tier === '升级', String(data.result.tier));
    check('canAdvance = true', data.result.canAdvance === true);

    fire(mp, 'finish', {}, 'step/step').catch(() => {});
    await sleep(2500);
    const st1 = await retry(() => readState(mp), 4, 800);
    check('训练记录写入本地存储', (st1.sessions || []).length === 1, `sessions=${(st1.sessions || []).length}`);
    check('这一式被记为"已通过"', !!(st1.steps || {})['pushup-01'], JSON.stringify(st1.steps || {}));
    check('训练记录挂在第 1 式上', (st1.sessions[0] || {}).no === 1, JSON.stringify(st1.sessions[0] || {}));
    // 说明：mock 的函数收不到调用参数（SDK 只把 mockWxMethod 的额外 args 传进去），
    // 所以这里没法把跳转 URL 记回 Node。「跳到哪里」由 L4 页面层断言（有 wx 打桩）；
    // 本层负责证明"存储真的写进去了、进度真的前进了"。

    // ★ 访谈回归：用户点「留在本式」+ 直接返回列表 → 第 2 式必须显示"进行中"
    const artAfterPass = await mp.reLaunch('/pages/art/art?artId=pushup');
    await artAfterPass.waitFor(900);
    const artPassData = await readData(mp);
    check('达标后第 1 式 = 已通过', artPassData.steps[0].state === 'passed', artPassData.steps[0].state);
    check('达标后第 2 式 = 进行中（回归：访谈里这里一个"进行中"都没有）',
      artPassData.steps[1].state === 'current' && artPassData.steps[1].stateText === '进行中',
      artPassData.steps.slice(0, 3).map(s => s.stateText).join(' | '));
    check('列表里"进行中"只有 1 个（锁定式推进的必然结果）',
      artPassData.steps.filter(s => s.isCurrent).length === 1,
      String(artPassData.steps.filter(s => s.isCurrent).length));
    await shot(mp, 'after-advance');

    // ============================================================ 6. 第十式 → 通关
    step('第十式做满 → 通关（回归：曾经无法通关、进度卡 90%）');
    // 通关 = 十式全部通过，所以先把前九式标记为已通过
    const ninePassed = {};
    for (let i = 1; i <= 9; i++) ninePassed['pushup-' + String(i).padStart(2, '0')] = { passedAt: Date.now() };
    await seed(mp, {
      version: 2,
      arts: {},
      sessions: st1.sessions || [],
      steps: ninePassed,
      drafts: {}
    });
    page = await mp.reLaunch('/pages/step/step?artId=pushup&no=10');
    await page.waitFor(900);
    data = await readData(mp, 'pages/step/step');
    check('识别为最后一式', data.isLast === true);
    check('显示"最后一式"提示条', /通关/.test((await textOf(mp, '.final-tip')) || ''));

    await mp.mockWxMethod('showModal', { confirm: true, cancel: false });
    await mp.mockWxMethod('navigateBack', function () { globalThis.__backCalled = true; });
    await recordSet(mp, 10);   // 单臂俯卧撑 升级标准：每侧 2 组 × 10
    await recordSet(mp, 10);
    check('达成【升级】', (await readData(mp)).result.tier === '升级');
    fire(mp, 'finish', {}, 'step/step').catch(() => {});
    await sleep(2500);
    const st2 = await retry(() => readState(mp), 4, 800);
    check('已标记通关', !!(st2.arts.pushup && st2.arts.pushup.completed), JSON.stringify(st2.arts.pushup));
    check('首次通关时间已记录', st2.arts.pushup.completedAt > 0);
    check('通关记录已落库（第 10 式）', (st2.sessions || []).some(s => s.no === 10));
    check('弹窗确认后请求返回上一页', (await mp.evaluate(() => globalThis.__backCalled)) === true);
    // 注意：不要 restoreWxMethod('showModal')——SDK 的 restore 会把 API 恢复成"不存在"，
    // 后续场景再调 wx.showModal 就报 "wx.showModal not exists"。保持 mock 即可。
    await shot(mp, 'art-completed');

    // ============================================================ 7. 首页推荐顺延
    step('回首页 → 推荐顺延（回归：曾经仍推荐俯卧撑第 10 式）');
    page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(900);
    data = await readData(mp);
    check('推荐顺延到 深蹲 第 1 式',
      data.main && data.main.artId === 'squat' && data.main.no === 1, JSON.stringify(data.main));
    check('推荐原因 = 已通关 1 艺', /已通关 1 艺/.test(data.main.reason || ''), data.main.reason);
    check('未进入全通关态', data.allDone === false);
    check('已通关计数 = 1', data.completedCount === 1, String(data.completedCount));
    check('俯卧撑卡片显示"已通关"（渲染层）',
      data.arts[0].stateText === '已通关' && /已通关/.test((await textOf(mp, '.art-state-text')) || ''),
      data.arts[0].stateText + ' / ' + (await textOf(mp, '.art-state-text')));
    check('未通关的艺不显示"已通关"', data.arts[1].stateText !== '已通关', data.arts[1].stateText);
    check('俯卧撑进度条 100%', data.arts[0].percent === 100, String(data.arts[0].percent));
    await shot(mp, 'home-next-art');

    // ============================================================ 8. 六艺全通关
    step('六艺全通关 → 首页完成态');
    const all = { version: 1, arts: {}, sessions: st2.sessions || [] };
    ['pushup', 'squat', 'pullup', 'legraise', 'bridge', 'handstand'].forEach(id => {
      all.arts[id] = { completed: true, completedAt: Date.now() };
    });
    await seed(mp, all);
    page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(900);
    data = await readData(mp);
    check('进入全部通关态', data.allDone === true);
    check('推荐卡片被替换（main 为空）', data.main === null, JSON.stringify(data.main));
    check('六艺全部 100%', data.arts.every(a => a.percent === 100));
    check('计数 6 / 6', data.completedCount === 6, String(data.completedCount));
    check('显示"全部通关"标题', /全部通关/.test((await textOf(mp, '.all-done-title')) || ''));
    await shot(mp, 'home-all-done');

    // ============================================================ 9. 未达标的完成反馈
    step('未达标就"完成本次训练" → 明确反馈（回归：真机上曾像点击无反应）');
    await seed(mp, { version: 1, arts: {}, sessions: [] });
    page = await mp.reLaunch('/pages/step/step?artId=pushup&no=1');
    await page.waitFor(900);
    await recordSet(mp, 25);
    await recordSet(mp, 25);
    // 这一步会弹真实弹窗，mock 成"确认"避免弹窗残留挡住后续操作
    await mp.mockWxMethod('showModal', { confirm: true, cancel: false });
    fire(mp, 'finish', {}, 'step/step').catch(() => {});
    await sleep(1500);
    data = await readData(mp, 'pages/step/step');
    check('页面留下"上一次记录"结果', !!data.lastSummary, JSON.stringify(data.lastSummary));
    check('结果写明达成档位', /中级/.test((data.lastSummary || {}).tierText || ''), (data.lastSummary || {}).tierText);
    check('结果写明还差多少', /还差 3 组 × 50次/.test((data.lastSummary || {}).gapText || ''), (data.lastSummary || {}).gapText);
    check('记录已落库（1 条）', ((await readState(mp)).sessions || []).length === 1);
    check('组数已清空，可继续记录', data.values.length === 0, String(data.values.length));
    check('"上一次记录"卡片已渲染', !!(await query(mp, '.last-result')));

    // 往返验证：用户"回列表 / 重进详情"必须看得见练过的痕迹
    const artPage = await mp.reLaunch('/pages/art/art?artId=pushup');
    await artPage.waitFor(900);
    const artData = await readData(mp);
    check('列表：当前式显示"进行中"（可练）',
      artData.steps[0].stateText === '进行中', artData.steps[0].stateText);
    check('列表：副文案短到"已练 1 次"（回归①：曾经看不出练过；②：曾经太长挤折左侧）',
      artData.steps[0].stateSub === '已练 1 次' && artData.steps[0].lastTier === '中级',
      JSON.stringify(artData.steps[0].stateSub));
    check('列表：未达标的下一式 = 未解锁（没通过就不解锁）',
      artData.steps[1].stateText === '未解锁', artData.steps[1].stateText);
    check('列表：未解锁的行不再重复"先通过第 N 式"（同一句重复 8 遍是噪音）',
      artData.steps[1].stateSub === '', JSON.stringify(artData.steps[1].stateSub));
    check('列表：副文案都很短（半宽卡片里不跟左侧抢位置）',
      artData.steps.every(s => (s.stateSub || '').length <= 6),
      artData.steps.map(s => s.stateSub).filter(Boolean).join(' | '));

    const stepPage = await mp.reLaunch('/pages/step/step?artId=pushup&no=1');
    await stepPage.waitFor(900);
    const stData = await readData(mp);
    check('重进详情页能看到历史记录（回归：曾完全看不到）', stData.historyCount === 1, String(stData.historyCount));
    check('历史记录内容正确',
      stData.history[0] && stData.history[0].setsText === '25 / 25' && stData.history[0].tier === '中级',
      JSON.stringify(stData.history[0]));
    check('历史卡片已渲染', !!(await query(mp, '.hist-row')));

    // ★ 访谈头号诉求：按标准一键记录（不用逐组手输）
    step('快捷档位：点「中级」→ 直接变成 2 组 × 25（回归：访谈说"要手输次数，太麻烦"）');
    check('快捷档位按钮渲染 3 个', (await queryAll(mp, '.quick-btn')).length === 3);
    await fire(mp, 'clearSets', {}, 'step/step');
    await sleep(400);
    await fire(mp, 'applyTier', { currentTarget: { dataset: { i: 1 } } }, 'step/step');
    await sleep(600);
    const quick = await readData(mp, 'pages/step/step');
    check('一键填入 = 2 组 × 25', JSON.stringify(quick.values) === '[25,25]', JSON.stringify(quick.values));
    check('判定立刻变成【中级】', quick.result.tier === '中级', String(quick.result.tier));
    check('组标签已渲染 2 个', (await queryAll(mp, '.sets .chip.on')).length === 2);
    await shot(mp, 'quick-tier');

    // ★ 锁定式推进：未解锁的式只能看，不能记
    step('锁定：未解锁的式只能看，不能记录（只有在练的那一式能记）');
    const locked = await mp.reLaunch('/pages/step/step?artId=pushup&no=3');
    await locked.waitFor(900);
    const lockedData = await readData(mp, 'pages/step/step');
    check('第 3 式显示为未解锁', lockedData.locked === true, String(lockedData.locked));
    check('顶部横幅说明未解锁', lockedData.banner && lockedData.banner.kind === 'locked', JSON.stringify(lockedData.banner));
    check('页面写明先通过哪一式', /先通过第 1 式/.test(lockedData.lockHint || ''), lockedData.lockHint);
    check('动作图与三档标准照常可见（"仅支持查看"）',
      (await queryAll(mp, '.tier-row')).length === 3 && (!!(await query(mp, '.pose')) || !!(await query(mp, '.pose-empty'))));
    check('未解锁时不出现记录按钮', !(await query(mp, '.add-btn')));
    await shot(mp, 'step-locked');

    // ★ 点「下一式」只浏览，不改变当前式（语义反转，旧断言已删）
    step('锁定：点「下一式」只是查看，不会把当前式带走');
    const stepPage2 = await mp.reLaunch('/pages/step/step?artId=pushup&no=1');
    await stepPage2.waitFor(900);
    await fire(mp, 'goNext', {}, 'step/step');
    await sleep(1500);
    const st3 = await readState(mp);
    check('存储里已不再有 currentNo 字段（改成推导）',
      !(st3.arts && st3.arts.pushup && 'currentNo' in st3.arts.pushup),
      JSON.stringify(st3.arts && st3.arts.pushup));
    const artPage2 = await mp.reLaunch('/pages/art/art?artId=pushup');
    await artPage2.waitFor(900);
    const artData2 = await readData(mp);
    check('翻页后当前式仍是第 1 式（只是"查看"第 2 式）',
      artData2.steps[0].isCurrent === true && artData2.steps[1].isCurrent === false,
      artData2.steps.slice(0, 2).map(s => s.no + ':' + s.stateText + (s.isCurrent ? '(当前)' : '')).join(' | '));
    await shot(mp, 'finish-no-advance');

    // ============================================================ 10. 收尾
    step('收尾：还原成"全新用户"（不污染手动测试数据）');
    await seed(mp, { version: 1, arts: {}, sessions: [] });
    page = await mp.reLaunch('/pages/index/index');
    await page.waitFor(700);
    data = await readData(mp);
    check('已还原：推荐回到俯卧撑第 1 式',
      data.main && data.main.artId === 'pushup' && data.main.no === 1 && data.allDone === false);
  } catch (e) {
    // ⚠ 场景崩溃必须记成一条失败：否则后面的场景没跑，总数会显示成"19/19 通过"并 exit 0
    // ——踩过：一次 'page node not found' 让整轮只跑了前 3 个场景，却报"全部通过"。
    check(`场景「${scenario}」执行完成`, false, (e && e.message) || String(e));
    console.error(`\n✗ 场景「${scenario}」出错：${e && e.message}`);
  } finally {
    await mp.close().catch(() => {});
  }

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`E2E：${pass} / ${results.length} 通过`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(f => console.log(`  ✗ ${f.name}  ← ${f.detail}`));
  }
  if (results.length !== EXPECTED_CHECKS) {
    console.log(`\n⚠ 断言条数异常：本次只跑了 ${results.length} 条，期望 ${EXPECTED_CHECKS} 条 —— 说明中途崩了，别把它当"通过"。`);
  }
  console.log(`截图：e2e/shots/（${shotIndex} 张）`);
  process.exit((failed.length || results.length !== EXPECTED_CHECKS) ? 1 : 0);
})();
