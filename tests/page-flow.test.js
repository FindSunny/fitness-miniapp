/**
 * 页面级测试：驱动真实页面代码，覆盖"页面把数据拼错了"这类 bug
 *
 * 注意：先 install() 再 require 页面/store，store.js 才会走 wx 存储分支。
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const env = require('./helpers/miniapp-stub.js').install();

const store = require('../miniprogram/utils/store.js');
const { ARTS, getArt } = require('../miniprogram/data/arts.js');
const P = path.join(__dirname, '..', 'miniprogram', 'pages');
const INDEX = path.join(P, 'index', 'index.js');
const STEP = path.join(P, 'step', 'step.js');
const ART = path.join(P, 'art', 'art.js');

function fresh() { store.reset(); env.resetCalls(); }

// ---------------------------------------------------------------- 首页推荐

test('首页：没有记录时推荐俯卧撑第 1 式', () => {
  fresh();
  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.main.artId, 'pushup');
  assert.strictEqual(page.data.main.no, 1);
  assert.strictEqual(page.data.allDone, false);
});

test('首页：俯卧撑通关后，推荐自动顺延到深蹲（回归：曾经仍推荐俯卧撑第 10 式）', () => {
  fresh();
  store.setCurrentNo('pushup', 10);
  store.completeArt('pushup');
  // 通关那一刻留下的训练记录，也不该把推荐拉回俯卧撑
  store.addSession({ artId: 'pushup', stepId: 'pushup-10', no: 10, values: [10, 10], tier: '升级', ts: Date.now() });

  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.main.artId, 'squat', '已通关的艺不应再被推荐');
  assert.strictEqual(page.data.main.no, 1);
  assert.strictEqual(page.data.main.mode, 'next');
  assert.match(page.data.main.reason, /已通关 1 艺/);
  assert.strictEqual(page.data.allDone, false);
  assert.strictEqual(page.data.completedCount, 1);
});

test('首页：正在练深蹲（未通关）时，推荐深蹲而不是俯卧撑', () => {
  fresh();
  store.setCurrentNo('pushup', 10);
  store.completeArt('pushup');
  store.completeArt; // noop，保持可读
  store.setCurrentNo('squat', 3);
  store.addSession({ artId: 'squat', stepId: 'squat-03', no: 3, values: [10], ts: Date.now() });

  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.main.artId, 'squat');
  assert.strictEqual(page.data.main.no, 3);
  assert.strictEqual(page.data.main.mode, 'continue');
  assert.match(page.data.main.reason, /上次练的是深蹲/);
});

test('首页：重置俯卧撑后，它会重新回到推荐位（重置的语义就是要重练）', () => {
  fresh();
  store.setCurrentNo('pushup', 10);
  store.completeArt('pushup');
  store.addSession({ artId: 'pushup', stepId: 'pushup-10', no: 10, values: [10, 10], tier: '升级', ts: Date.now() });
  store.resetArt('pushup');

  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.main.artId, 'pushup');
  assert.strictEqual(page.data.main.no, 1);
  assert.strictEqual(page.data.completedCount, 0);
  const card = page.data.arts.find(a => a.id === 'pushup');
  assert.strictEqual(card.completed, false);
  assert.strictEqual(card.percent, 0, '重置后进度条应回到 0');
});

test('首页：六艺全部通关 → 进入完成态', () => {
  fresh();
  ARTS.forEach(a => { store.setCurrentNo(a.id, 10); store.completeArt(a.id); });
  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.allDone, true);
  assert.strictEqual(page.data.main, null);
  assert.strictEqual(page.data.completedCount, 6);
  page.data.arts.forEach(c => {
    assert.strictEqual(c.completed, true);
    assert.strictEqual(c.percent, 100);
  });
});

test('首页：全部通关后重置一个艺 → 推荐回到该艺（而不是完成态）', () => {
  fresh();
  ARTS.forEach(a => { store.setCurrentNo(a.id, 10); store.completeArt(a.id); });
  store.resetArt('bridge');
  const page = env.load(INDEX);
  page.onShow();
  assert.strictEqual(page.data.allDone, false);
  assert.strictEqual(page.data.main.artId, 'bridge');
  assert.strictEqual(page.data.completedCount, 5);
});

test('首页：图 x/10 计数正确（回归：曾经把俯卧撑显示成 9/10）', () => {
  fresh();
  const page = env.load(INDEX);
  page.onShow();
  const by = id => page.data.arts.find(a => a.id === id);
  assert.strictEqual(by('pushup').drawn, 10, '俯卧撑十式图已画全，应显示 10/10');
  assert.strictEqual(by('squat').drawn, 0, '深蹲只有封面图，逐式图应为 0');
  assert.strictEqual(by('bridge').drawn, 0);
});

test('详情页：记一组立刻落盘，离开再进来还在（回归：真机曾"返回后数据没了"）', () => {
  fresh();
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  page.setData({ input: '25' });
  page.addSet();
  assert.strictEqual(store.pendingSets(), 1, '记一组应立即落盘（不等"完成本次训练"）');

  // 模拟"返回首页 → 再进来"：重新加载页面实例
  const page2 = env.load(STEP);
  page2.onLoad({ artId: 'pushup', no: '1' });
  assert.deepStrictEqual(page2.data.values, [25], '重新进入应恢复未提交的组');
  assert.strictEqual(page2.data.restored, true);
  assert.strictEqual(page2.data.result.tier, '初级', '恢复后判定也要跟着回来');

  // 首页应提示有未提交的组
  const idx = env.load(INDEX);
  idx.onShow();
  assert.strictEqual(idx.data.pendingSets, 1);
  assert.strictEqual(idx.data.storeInfo.pending, 1);
  assert.match(idx.data.pendingList[0].stepId, /^pushup-01$/);
});

test('详情页：提交后草稿清掉，转成正式记录', () => {
  fresh();
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  ['50', '50', '50'].forEach(v => { page.setData({ input: v }); page.addSet(); });
  assert.strictEqual(store.pendingSets(), 3);

  page.finish();
  assert.strictEqual(store.pendingSets(), 0, '提交后不应残留草稿');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '应转成一条正式记录');
  assert.strictEqual(page.data.lastSummary.count, 3);
});

test('详情页：删除某组 / 清空 会同步更新草稿', () => {
  fresh();
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  ['10', '20', '30'].forEach(v => { page.setData({ input: v }); page.addSet(); });
  page.removeSet({ currentTarget: { dataset: { i: 1 } } });
  assert.deepStrictEqual(store.getDraft('pushup-01').values, [10, 30], '删组要同步到草稿');
  page.clearSets();
  assert.strictEqual(store.getDraft('pushup-01'), null, '清空要删掉草稿');
  assert.strictEqual(store.pendingSets(), 0);
});

// ------------------------------------------------- 验收清单里发现未覆盖的三项（补上）

test('验收#10：详情页点「下一式」把当前式跟过去（回归：曾不跟随）', () => {
  fresh();
  store.setCurrentNo('pushup', 1);
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  page.goNext();
  assert.strictEqual(store.currentNo('pushup'), 2, '当前式应跟到第 2 式');
  assert.ok(env.calls.nav.some(n => /artId=pushup&no=2/.test(n.url || '')), '应跳转到第 2 式');

  // 反向：点上一式也要跟随
  const p2 = env.load(STEP);
  p2.onLoad({ artId: 'pushup', no: '2' });
  p2.goPrev();
  assert.strictEqual(store.currentNo('pushup'), 1, '点上一式应跟回第 1 式');
});

test('验收#3：首页点"有 N 组未提交"提示会跳到对应那一式', () => {
  fresh();
  store.saveDraft('pushup-02', [15]);
  const idx = env.load(INDEX);
  idx.onShow();
  assert.strictEqual(idx.data.pendingSets, 1);
  assert.strictEqual(idx.data.pendingList[0].stepId, 'pushup-02');

  idx.goStepById({ currentTarget: { dataset: { id: 'pushup-02' } } });
  assert.ok(env.calls.nav.some(n => /artId=pushup&no=2/.test(n.url || '')),
    '应跳到第 2 式：' + JSON.stringify(env.calls.nav));
});

test('验收#16：列表页重置清掉已通过与进度，但保留训练记录', () => {
  fresh();
  const art = getArt('pushup');
  art.steps.slice(0, 3).forEach(s => store.setStepPassed(s.id, true));
  store.setCurrentNo('pushup', 4);
  store.addSession({ artId: 'pushup', stepId: 'pushup-03', no: 3, values: [30, 30, 30], tier: '升级', ts: Date.now() });

  const page = env.load(ART);
  page.onLoad({ artId: 'pushup' });
  page.onShow();
  assert.strictEqual(page.data.passedCount, 3);

  page.resetProgress();
  env.answerModal(true);            // 确认重置
  assert.strictEqual(page.data.passedCount, 0, '已通过标记应清空');
  assert.strictEqual(page.data.status.percent, 0, '进度应归零');
  assert.strictEqual(page.data.currentNo, 1, '当前式应回到第 1 式');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '训练记录必须保留');
  assert.strictEqual(page.data.sessionsTotal, 1);
});

// ---------------------------------------------------------------- 详情页通关流程

test('详情页：第十式达标 + 其余九式已通过 → 通关、停在第 10 式、弹「全部完成」', () => {
  fresh();
  const art = getArt('pushup');
  art.steps.slice(0, 9).forEach(s => store.setStepPassed(s.id, true));
  store.setCurrentNo('pushup', 10);

  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '10' });
  assert.strictEqual(page.data.isLast, true);
  assert.strictEqual(page.data.banner.kind, 'current', '还没通过，横幅应是"当前在练"');

  page.setData({ input: '10' }); page.addSet();   // 单臂俯卧撑升级标准：每侧 2 组 × 10
  page.setData({ input: '10' }); page.addSet();
  assert.strictEqual(page.data.result.canAdvance, true);

  page.finish();
  assert.strictEqual(store.isStepPassed('pushup-10'), true, '这一式应记为已通过');
  assert.strictEqual(store.isCompleted('pushup'), true, '十式全通过才算通关');
  assert.strictEqual(store.currentNo('pushup'), 10, '通关不应再前进式号');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '训练记录应保存');

  const modal = env.calls.modal.at(-1);
  assert.match(modal.title, /全部完成/);
  assert.match(modal.content, /俯卧撑/);
  env.answerModal(true);
  assert.ok(env.calls.nav.some(n => n.back), '应返回上一页看进度');
});

test('详情页：只通过第 10 式不算通关（回归：曾误报"全部完成"）', () => {
  fresh();
  store.setCurrentNo('pushup', 10);
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '10' });
  page.setData({ input: '10' }); page.addSet();
  page.setData({ input: '10' }); page.addSet();
  page.finish();

  assert.strictEqual(store.isStepPassed('pushup-10'), true, '这一式本身应记为已通过');
  assert.strictEqual(store.isCompleted('pushup'), false, '其余九式没通过，不能算通关');
  const modal = env.calls.modal.at(-1);
  assert.match(modal.title, /这一式已通过/, '应说清"只是这一式通过了"');
  assert.match(modal.content, /还有 9 式没通过/);
});

test('详情页：未达标就完成 → 有明确反馈，不再"像点击没反应"（回归）', () => {
  fresh();
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });       // 墙壁俯卧撑 1×10 / 2×25 / 3×50
  ['25', '25'].forEach(v => { page.setData({ input: v }); page.addSet(); });
  page.finish();

  // 必须弹窗说清楚结果和下一步（以前只弹 toast + 清空，观感是"没反应"）
  const modal = env.calls.modal.at(-1);
  assert.ok(modal, '应该有弹窗反馈');
  assert.match(modal.title, /本次已记录/);
  assert.match(modal.content, /2 组/, '弹窗里要有组数');
  assert.match(modal.content, /中级/, '弹窗里要有达成档位');
  assert.match(modal.content, /还差 3 组 × 50次/, '弹窗里要有距升级差多少');
  assert.strictEqual(modal.confirmText, '再练一组');
  assert.strictEqual(modal.cancelText, '回十式列表');
  assert.match(modal.content, /已保存到本机（本式共 1 次/, '弹窗必须回报"存到哪、存了几次"');

  // 结果也要留在页面上（弹窗关掉后还能看到）
  assert.ok(page.data.lastSummary, '应留下 lastSummary');
  assert.strictEqual(page.data.lastSummary.tierText, '当前已达成【中级】');
  assert.match(page.data.lastSummary.gapText, /还差 3 组/);
  assert.strictEqual(page.data.lastSummary.count, 2);
  assert.strictEqual(page.data.lastSummary.savedOk, true);
  assert.match(page.data.lastSummary.savedLine, /已保存到本机（本式共 1 次/);

  assert.strictEqual(page.data.values.length, 0, '组数应清空，可继续记录');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '记录应落库');

  // 点「回十式列表」应返回上一页
  env.answerModal(false);
  assert.ok(env.calls.nav.some(n => n.back), '点取消应返回列表');
});

test('详情页：第十式未达标 → 只记录，不通关', () => {
  fresh();
  store.setCurrentNo('pushup', 10);
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '10' });
  page.setData({ input: '5' }); page.addSet();     // 只到初级
  page.finish();

  assert.strictEqual(store.isCompleted('pushup'), false, '没达标不该通关');
  const modal = env.calls.modal.at(-1);
  assert.ok(modal && /本次已记录/.test(modal.title), '应是"本次已记录"而不是通关弹窗');
  assert.ok(!/全部完成/.test(modal.title));
  assert.strictEqual(store.sessionsOf('pushup').length, 1);
});

test('详情页：通关后复习第 10 式，通关标记与首次通关时间都不被覆盖', () => {
  fresh();
  // 先让前九式已通过，第 10 式达标即通关
  getArt('pushup').steps.slice(0, 9).forEach(s => store.setStepPassed(s.id, true));
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '10' });
  page.setData({ input: '10' }); page.addSet();
  page.setData({ input: '10' }); page.addSet();
  page.finish();
  const firstAt = store.getState().arts.pushup.completedAt;
  env.answerModal(false);
  assert.strictEqual(store.isCompleted('pushup'), true);

  // 隔一会儿再练一遍（复习）
  const page2 = env.load(STEP);
  page2.onLoad({ artId: 'pushup', no: '10' });
  page2.setData({ input: '10' }); page2.addSet();
  page2.setData({ input: '10' }); page2.addSet();
  page2.finish();

  assert.strictEqual(store.isCompleted('pushup'), true, '复习后仍应是通关状态');
  assert.strictEqual(store.getState().arts.pushup.completedAt, firstAt, '首次通关时间不应被覆盖');
  assert.ok(store.getState().arts.pushup.lastCompletedAt >= firstAt, '应记录最近一次通关时间');
  assert.strictEqual(store.sessionsOf('pushup').length, 2, '复习的记录与首次的记录都应保留');
});

test('详情页：非最后一式达标 → 弹晋级框，确认后进入下一式', () => {
  fresh();
  const page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });   // 墙壁俯卧撑 3 组 × 50
  ['50', '50', '50'].forEach(v => { page.setData({ input: v }); page.addSet(); });
  page.finish();

  const modal = env.calls.modal.at(-1);
  assert.match(modal.title, /达标了/);
  env.answerModal(true);
  assert.strictEqual(store.currentNo('pushup'), 2);
  assert.ok(env.calls.nav.some(n => /no=2/.test(n.url || '')), '应跳到第 2 式');
});

// ---------------------------------------------------------------- 十式列表状态

test('列表页：三种状态的文字与标记正确（含通关后全绿）', () => {
  fresh();
  const art = getArt('pushup');
  art.steps.slice(0, 3).forEach(s => store.setStepPassed(s.id, true));   // 已通过前三式
  store.setCurrentNo('pushup', 4);
  let page = env.load(ART);
  page.onLoad({ artId: 'pushup' });
  page.onShow();
  assert.strictEqual(page.data.status.percent, 30, '已通过 3/10 = 30%');
  assert.strictEqual(page.data.passedCount, 3);
  assert.deepStrictEqual(
    page.data.steps.slice(0, 5).map(s => s.state),
    ['passed', 'passed', 'passed', 'current', 'todo']
  );
  assert.deepStrictEqual(
    page.data.steps.slice(0, 5).map(s => s.stateText),
    ['已通过', '已通过', '已通过', '进行中', '未开始']
  );

  // 通关后：10 行全部已通过，进度 100%
  store.completeArt('pushup');
  page.onShow();
  assert.strictEqual(page.data.status.percent, 100);
  assert.strictEqual(page.data.completed, true);
  assert.ok(page.data.steps.every(s => s.state === 'passed'));
});

// ------------------------------------------------- 用户往返（回归：真机上"回来数据就没了"）

test('往返：练完提交 → 回列表 → 该式必须显示"已练 1 次"（回归：曾仍显示进行中）', () => {
  fresh();
  const step = env.load(STEP);
  step.onLoad({ artId: 'pushup', no: '1' });
  ['25', '25'].forEach(v => { step.setData({ input: v }); step.addSet(); });
  step.finish();
  assert.strictEqual(store.sessionsOf('pushup').length, 1);

  // 回列表页（新实例，模拟用户返回）
  const art = env.load(ART);
  art.onLoad({ artId: 'pushup' });
  art.onShow();
  assert.strictEqual(art.data.steps[0].state, 'current');
  assert.strictEqual(art.data.steps[0].stateText, '已练 1 次',
    '提交过就必须看得出练过，不能还显示"进行中"');
  assert.strictEqual(art.data.steps[0].lastTier, '中级');
  assert.strictEqual(art.data.practicedCount, 1);
  assert.strictEqual(art.data.sessionsTotal, 1);
  assert.strictEqual(art.data.steps[1].stateText, '未开始', '没达标就不该算通过');
});

test('往返：练完提交 → 重进详情页 → 必须看到这条历史记录（回归：曾完全看不到）', () => {
  fresh();
  let step = env.load(STEP);
  step.onLoad({ artId: 'pushup', no: '1' });
  ['25', '25'].forEach(v => { step.setData({ input: v }); step.addSet(); });
  step.finish();

  step = env.load(STEP);
  step.onLoad({ artId: 'pushup', no: '1' });
  assert.strictEqual(step.data.historyCount, 1, '重进必须看到刚才提交的记录');
  assert.strictEqual(step.data.history[0].count, 2);
  assert.strictEqual(step.data.history[0].setsText, '25 / 25');
  assert.strictEqual(step.data.history[0].tier, '中级');
  assert.match(step.data.history[0].tsText, /^\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.strictEqual(step.data.values.length, 0, '已提交的组不该再算草稿');
});

test('往返：记一组就离开 → 重进恢复；提交后草稿转历史', () => {
  fresh();
  let page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  page.setData({ input: '10' });
  page.addSet();

  page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  assert.deepStrictEqual(page.data.values, [10], '未提交的组要恢复');
  assert.strictEqual(page.data.historyCount, 0, '还没提交，历史为空');
  assert.strictEqual(page.data.restored, true);

  page.setData({ input: '10' }); page.addSet();
  page.setData({ input: '10' }); page.addSet();
  page.finish();

  page = env.load(STEP);
  page.onLoad({ artId: 'pushup', no: '1' });
  assert.strictEqual(page.data.values.length, 0, '提交后草稿清空');
  assert.strictEqual(page.data.historyCount, 1, '提交的记录出现在历史里');
  assert.strictEqual(page.data.history[0].count, 3);
  assert.strictEqual(store.pendingSets(), 0);
});
