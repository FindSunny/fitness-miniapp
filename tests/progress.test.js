/**
 * 晋级判定逻辑测试 —— 这是产品的核心规则，必须用测试锁住
 * 重点覆盖：达标/不达标边界、"还差几次"的计算、每侧、计时型、非常规标准
 */
const test = require('node:test');
const assert = require('node:assert');

const { getArt, getStep, ARTS } = require('../miniprogram/data/arts.js');
const P = require('../miniprogram/utils/progress.js');

const wall = () => getStep('pushup', 1);      // 1×10 / 2×25 / 3×50
const hand = () => getStep('handstand', 1);   // 30秒 / 60秒 / 120秒

test('空记录：没有任何档位', () => {
  const r = P.evaluate(wall(), []);
  assert.strictEqual(r.tierIndex, -1);
  assert.strictEqual(r.tier, null);
  assert.strictEqual(r.canAdvance, false);
  assert.strictEqual(r.valid, 0);
  assert.match(P.tierText(r), /还没记录/);
  assert.strictEqual(r.gap.tier, '初级');
  assert.strictEqual(r.gap.setsNeed, 1);
});

test('1×10 达成初级', () => {
  const r = P.evaluate(wall(), [10]);
  assert.strictEqual(r.tier, '初级');
  assert.strictEqual(r.canAdvance, false);
  assert.strictEqual(r.gap.tier, '中级');
  // 中级要求"2 组 × 25"，目前 0 组达到 25 → 还差 2 组
  assert.strictEqual(r.gap.setsNeed, 2);
  assert.strictEqual(r.gap.valueNeed, 25);
});

test('2×25 达成中级，并算出"还差 3 组 × 50 次"', () => {
  const r = P.evaluate(wall(), [25, 25]);
  assert.strictEqual(r.tier, '中级');
  // 升级要求"3 组 × 50"，目前 0 组达到 50 → 还差 3 组
  assert.strictEqual(r.gap.setsNeed, 3);
  assert.strictEqual(r.gap.valueNeed, 50);
  assert.match(P.gapText(r), /还差 3 组 × 50次/);
});

test('已经做了一部分下一档的组数时，缺口相应减少', () => {
  const r = P.evaluate(wall(), [25, 30, 55]); // 3 组达到 25 → 中级；其中 1 组达到 50
  assert.strictEqual(r.tier, '中级');
  assert.strictEqual(r.gap.setsNeed, 2);      // 升级要 3 组，已有 1 组 → 还差 2 组
});

test('3×50 达成升级 → 可以进下一式', () => {
  const r = P.evaluate(wall(), [50, 50, 50]);
  assert.strictEqual(r.tier, '升级');
  assert.ok(r.canAdvance);
  assert.strictEqual(r.next, null);
  assert.match(P.gapText(r), /进入下一式/);
});

test('组数够但数值不够，不算达标（2×50 只到中级）', () => {
  const r = P.evaluate(wall(), [50, 50]);
  assert.strictEqual(r.tier, '中级');
});

test('数值够但组数不够，不算达标（1×50 只到初级）', () => {
  const r = P.evaluate(wall(), [50]);
  assert.strictEqual(r.tier, '初级');
});

test('超量完成也算达标（4×60 到升级）', () => {
  const r = P.evaluate(wall(), [60, 60, 60, 60]);
  assert.strictEqual(r.tier, '升级');
  assert.ok(r.canAdvance);
});

test('乱序记录不影响判定（先多后少）', () => {
  assert.strictEqual(P.evaluate(wall(), [50, 12, 50, 50]).tier, '升级');
  assert.strictEqual(P.evaluate(wall(), [8, 30, 30]).tier, '中级');
});

test('非法值被过滤掉', () => {
  const r = P.evaluate(wall(), [0, -5, NaN, Infinity, 'x', null, 10]);
  assert.strictEqual(r.valid, 1);
  assert.strictEqual(r.tier, '初级');
});

test('计时型动作：30/60/120 秒', () => {
  assert.strictEqual(hand().unit, 'sec');
  assert.strictEqual(P.evaluate(hand(), [30]).tier, '初级');
  assert.strictEqual(P.evaluate(hand(), [45]).tier, '初级');
  assert.strictEqual(P.evaluate(hand(), [60]).tier, '中级');
  assert.strictEqual(P.evaluate(hand(), [120]).tier, '升级');
  assert.match(P.formatTier({ sets: 1, value: 30, unit: 'sec' }), /1 组 × 30秒/);
});

test('每侧动作：标准与提示都带"每侧"', () => {
  const oneArm = getStep('pushup', 10); // 1×5 / 2×5 / 2×10 每侧
  const r = P.evaluate(oneArm, [5]);
  assert.strictEqual(r.tier, '初级');
  assert.strictEqual(r.gap.perSide, true);
  assert.match(P.gapText(r), /每侧/);
  assert.match(P.formatStdLine(oneArm), /初级 1×5次/);
});

test('组数不单调的标准也要判对（单臂倒立撑 1×1 / 2×2 / 1×5）', () => {
  const s = getStep('handstand', 10);
  assert.deepStrictEqual(s.std, [[1, 1], [2, 2], [1, 5]]);
  assert.strictEqual(P.evaluate(s, [1]).tier, '初级');
  assert.strictEqual(P.evaluate(s, [2, 2]).tier, '中级');
  assert.strictEqual(P.evaluate(s, [5]).tier, '升级'); // 1 组 × 5 直接满足最高档
});

test('formatStdLine / formatTier 文案', () => {
  assert.strictEqual(P.formatStdLine(wall()), '初级 1×10次 · 中级 2×25次 · 升级 3×50次');
  assert.strictEqual(P.formatTier({ sets: 3, value: 50, unit: 'reps' }), '3 组 × 50次');
  assert.strictEqual(P.formatTier({ sets: 2, value: 10, unit: 'reps', perSide: true }), '2 组 × 10次（每侧）');
});

test('currentNo：当前式 = 第一个没通过的式（推导，不存储）', () => {
  const art = getArt('pushup');
  const ids = art.steps.map(s => s.id);
  const passedOf = n => {
    const m = {};
    ids.slice(0, n).forEach(id => { m[id] = true; });
    return m;
  };

  assert.strictEqual(P.currentNo(art, { passed: {} }), 1, '一式都没过 → 第 1 式');
  assert.strictEqual(P.currentNo(art, { passed: passedOf(3) }), 4);
  assert.strictEqual(P.currentNo(art, { passed: passedOf(9) }), 10);
  assert.strictEqual(P.currentNo(art, { passed: passedOf(10) }), null, '十式全通过 → 没有当前式');
  assert.strictEqual(P.currentNo(art, { passed: passedOf(10), completed: true }), null);
  // 中间挖空（老数据/异常数据）也要取"第一个"没过的
  const gap = passedOf(3); delete gap[ids[1]];
  assert.strictEqual(P.currentNo(art, { passed: gap }), 2);
});

test('canPractice：只有"已通过的式"和"当前式"能记录（锁定式推进）', () => {
  const art = getArt('pushup');
  const ids = art.steps.map(s => s.id);
  const passed = { [ids[0]]: true, [ids[1]]: true };   // 1、2 式通过 → 当前式 = 3
  const opts = { passed };
  const step = no => art.steps[no - 1];

  assert.strictEqual(P.canPractice(art, step(1), opts), true, '已通过的式可以复习记录');
  assert.strictEqual(P.canPractice(art, step(2), opts), true);
  assert.strictEqual(P.canPractice(art, step(3), opts), true, '当前式可以记录');
  assert.strictEqual(P.canPractice(art, step(4), opts), false, '当前式之后不能记录');
  assert.strictEqual(P.canPractice(art, step(10), opts), false);
  assert.strictEqual(P.canPractice(art, step(10), { passed, completed: true }), true, '通关后随便复习');
});

test('artStatus 进度换算（含通关）', () => {
  const art = getArt('pushup');
  const ids = art.steps.map(s => s.id);
  const passedOf = n => {
    const m = {};
    ids.slice(0, n).forEach(id => { m[id] = true; });
    return m;
  };

  assert.deepStrictEqual(
    [
      P.artStatus(art, { passed: {} }).percent,
      P.artStatus(art, { passed: passedOf(4) }).percent,
      P.artStatus(art, { passed: passedOf(9) }).percent
    ],
    [0, 40, 90]
  );
  assert.strictEqual(P.artStatus(art, { passed: {} }).current, 1);
  assert.strictEqual(P.artStatus(art, { passed: passedOf(9) }).current, 10, '当前式由"已通过表"推导');
  assert.strictEqual(P.artStatus(art, { passed: passedOf(9) }).atLastStep, true);
  assert.strictEqual(P.artStatus(art, { passed: passedOf(9) }).label, '进行中 · 第 10 式');
  assert.strictEqual(P.artStatus(art, { passed: passedOf(4) }).remaining, 6);

  const done = P.artStatus(art, { passed: passedOf(10), completed: true });
  assert.strictEqual(done.percent, 100);
  assert.strictEqual(done.done, 10);
  assert.strictEqual(done.completed, true);
  assert.strictEqual(done.label, '已通关');
  // 十式都通过 → 自动算通关（不依赖 completed 字段）
  assert.strictEqual(P.artStatus(art, { passed: passedOf(10) }).completed, true);
  assert.strictEqual(P.artStatus(art, { passed: passedOf(10) }).label, '已通关');
  // completed 为真但 passed 表不全（老数据）也要按通关算
  assert.strictEqual(P.artStatus(art, { completed: true }).percent, 100);
});

test('artStatus：「没练过」不能显示"进行中"（回归：真机验收发现六个艺全是进行中）', () => {
  const art = getArt('pushup');
  const ids = art.steps.map(s => s.id);
  const passedOf = n => {
    const m = {};
    ids.slice(0, n).forEach(id => { m[id] = true; });
    return m;
  };

  // ① 全新用户：一式没过、一条记录都没有 → 未开始
  const fresh = P.artStatus(art, { passed: {}, sessions: [] });
  assert.strictEqual(fresh.started, false);
  assert.strictEqual(fresh.stateText, '未开始');
  assert.strictEqual(fresh.label, '未开始', '宽地方（列表页进度卡）也不能写"进行中"');
  assert.strictEqual(fresh.current, 1, '内部当前式仍然是第 1 式，只是不这么显示');

  // ② 没有任何 sessions 参数时也不能误报成"进行中"（默认值要安全）
  assert.strictEqual(P.artStatus(art, { passed: {} }).stateText, '未开始');

  // ③ 过了至少一式 → 第 N 式
  const some = P.artStatus(art, { passed: passedOf(3), sessions: [] });
  assert.strictEqual(some.started, true);
  assert.strictEqual(some.stateText, '第 4 式');
  assert.strictEqual(some.label, '进行中 · 第 4 式');

  // ④ 没过任何一式、但练过（有记录）→ 也算开始，不能显示"未开始"
  const practiced = P.artStatus(art, { passed: {}, sessions: [{ no: 1, ts: 1 }] });
  assert.strictEqual(practiced.started, true);
  assert.strictEqual(practiced.stateText, '第 1 式');
  assert.strictEqual(practiced.label, '进行中 · 第 1 式');

  // ⑤ 通关 → 已通关（短/长两个文案一致）
  const done = P.artStatus(art, { passed: passedOf(10), completed: true, sessions: [] });
  assert.strictEqual(done.started, true);
  assert.strictEqual(done.stateText, '已通关');
  assert.strictEqual(done.label, '已通关');

  // ⑥ stateText 必须短到能在半个卡片宽里一行放下
  assert.ok(fresh.stateText.length <= 4 && some.stateText.length <= 5, '短文案不能超过 5 个字');
});

test('countRecentDays 只统计窗口内的天数', () => {
  const now = Date.now();
  const sessions = [
    { ts: now },
    { ts: now - 3600 * 1000 },
    { ts: now - 8 * 24 * 3600 * 1000 }
  ];
  assert.strictEqual(P.countRecentDays(sessions, 7, now), 1);
  assert.strictEqual(P.countRecentDays(sessions, 30, now), 2);
  assert.strictEqual(P.countRecentDays([], 7, now), 0);
});

test('推荐：优先最近练过、且未通关的艺', () => {
  const arts = ARTS;
  const r = P.recommend(arts, {
    sessions: [{ artId: 'squat', ts: 100 }, { artId: 'pushup', ts: 200 }],
    currentNoOf: id => ({ pushup: 5, squat: 3 }[id] || 1),
    isCompleted: () => false
  });
  // pushup 最近（ts 200），两个都没通关 → 推荐 pushup 第 5 式
  assert.strictEqual(r.art.id, 'pushup');
  assert.strictEqual(r.no, 5);
  assert.strictEqual(r.mode, 'continue');
  assert.match(r.reason, /上次练的是俯卧撑/);
});

test('推荐：最近练的艺已通关 → 跳过它，顺延到下一个未通关的艺', () => {
  const r = P.recommend(ARTS, {
    sessions: [{ artId: 'pushup', ts: 999 }],   // 最近练的是俯卧撑，但已通关
    currentNoOf: () => 1,
    isCompleted: id => id === 'pushup'
  });
  assert.strictEqual(r.art.id, 'squat');        // 按六艺顺序顺延
  assert.strictEqual(r.no, 1);
  assert.strictEqual(r.mode, 'next');
  assert.match(r.reason, /已通关 1 艺/);
});

test('推荐：通关多个后继续顺延（俯卧撑+深蹲已通关 → 引体向上）', () => {
  const r = P.recommend(ARTS, {
    sessions: [{ artId: 'squat', ts: 500 }],
    currentNoOf: () => 1,
    isCompleted: id => ['pushup', 'squat'].includes(id)
  });
  assert.strictEqual(r.art.id, 'pullup');
});

test('推荐：没有任何记录 → 从第一个艺开始', () => {
  const r = P.recommend(ARTS, { sessions: [], currentNoOf: () => 1, isCompleted: () => false });
  assert.strictEqual(r.art.id, 'pushup');
  assert.strictEqual(r.no, 1);
  assert.strictEqual(r.mode, 'next');
});

test('推荐：六艺全部通关 → all-done', () => {
  const r = P.recommend(ARTS, { sessions: [{ artId: 'bridge', ts: 9 }], currentNoOf: () => 10, isCompleted: () => true });
  assert.strictEqual(r.mode, 'all-done');
  assert.strictEqual(r.art, null);
  assert.strictEqual(r.step, null);
});

test('推荐：式号越界时收敛到有效范围', () => {
  const r = P.recommend(ARTS, { sessions: [], currentNoOf: () => 99, isCompleted: () => false });
  assert.strictEqual(r.no, 10);
});

test('stepStates：锁定式推进下只有三态（已通过 / 进行中 / 未解锁）', () => {
  const art = getArt('pushup');
  const sessions = [
    { no: 1, tier: '中级', ts: 1000 },
    { no: 1, tier: '初级', ts: 2000 }
  ];

  // ① 一式都没过：第 1 式进行中，其余全部未解锁
  let st = P.stepStates(art, { passed: {}, sessions });
  assert.strictEqual(st[0].state, 'current');
  assert.strictEqual(st[0].stateText, '进行中');
  assert.strictEqual(st[0].times, 2);
  assert.strictEqual(st[0].lastTier, '初级', '取最近一次的成绩');
  assert.strictEqual(st[0].stateSub, '已练 2 次 · 最近：初级');
  assert.ok(st.slice(1).every(s => s.state === 'locked' && s.stateText === '未解锁'), '当前式之后都不能练');
  assert.strictEqual(st[1].stateSub, '先通过第 1 式');

  // ② 第 1 式通过 → 第 2 式自动变成进行中（不需要任何额外操作）
  st = P.stepStates(art, { passed: { 'pushup-01': true }, sessions });
  assert.strictEqual(st[0].state, 'passed');
  assert.strictEqual(st[0].stateText, '已通过');
  assert.strictEqual(st[0].stateSub, '已练 2 次 · 最近：初级', '已通过也要看得到练过几次');
  assert.strictEqual(st[1].state, 'current', '回归：达标后下一式必须是进行中');
  assert.strictEqual(st[1].stateSub, '可以开始练');
  assert.ok(st.slice(2).every(s => s.isLocked));

  // ③ 只有草稿（记了一组但没提交）→ 当前式副文案要显示"有 N 组未提交"
  st = P.stepStates(art, { passed: {}, sessions: [], drafts: [{ stepId: 'pushup-01', values: [25] }] });
  assert.strictEqual(st[0].state, 'current');
  assert.strictEqual(st[0].draftCount, 1);
  assert.strictEqual(st[0].stateSub, '有 1 组未提交');

  // ④ 唯一性：任何情况下"进行中"最多一个
  const passed3 = { 'pushup-01': true, 'pushup-02': true };
  st = P.stepStates(art, {
    passed: passed3,
    sessions: [{ no: 1, tier: '初级', ts: 1 }, { no: 5, tier: '初级', ts: 2 }],
    drafts: [{ stepId: 'pushup-02', values: [1, 1] }]
  });
  assert.strictEqual(st.filter(s => s.state === 'current').length, 1, '进行中只能有一个（锁定式推进的自然结果）');
  assert.strictEqual(st[2].state, 'current');
  assert.strictEqual(st[0].state, 'passed', '已通过的式即使有记录也还是"已通过"');
  // 越权记录（异常数据：解锁前就有历史成绩）不改变状态，仍然是未解锁
  assert.strictEqual(st[4].state, 'locked');
  assert.strictEqual(st[4].times, 1, '但历史次数照实显示');

  // ⑤ 通关 → 全部已通过，没有进行中
  st = P.stepStates(art, { passed: {}, completed: true, sessions });
  assert.ok(st.every(s => s.state === 'passed' && s.stateText === '已通过'));
  assert.ok(st.every(s => !s.isCurrent));
});

test('stepBanner：详情页顶部状态说明（三种）', () => {
  const art = getArt('pushup');
  const step1 = getStep('pushup', 1);

  // 已通过
  let b = P.stepBanner(art, step1, { isPassed: true, times: 3, lastTier: '升级' });
  assert.strictEqual(b.kind, 'passed');
  assert.match(b.title, /已通过/);
  assert.match(b.sub, /第 2 式/);

  // 当前式且练过
  b = P.stepBanner(art, step1, { isCurrent: true, times: 2, lastTier: '中级' });
  assert.strictEqual(b.kind, 'current');
  assert.match(b.sub, /已练 2 次/);
  assert.match(b.sub, /中级/);

  // 当前式但没练过
  b = P.stepBanner(art, step1, { isCurrent: true, times: 0 });
  assert.strictEqual(b.kind, 'current');
  assert.match(b.sub, /还没有提交过记录/);

  // 未解锁（回归：访谈里"进到没解锁的式，不知道该怎么办"）
  const step5 = getStep('pushup', 5);
  b = P.stepBanner(art, step5, { isPassed: false, isCurrent: false, unlockHint: '先通过第 2 式（上斜俯卧撑）' });
  assert.strictEqual(b.kind, 'locked');
  assert.match(b.title, /没解锁/);
  assert.match(b.sub, /先通过第 2 式/);
});

test('formatTime / sessionText 文案', () => {
  const t = P.formatTime(new Date(2026, 8, 29, 11, 5).getTime());
  assert.strictEqual(t, '09-29 11:05');
  assert.strictEqual(P.sessionText({ values: [25, 25], unit: 'reps' }), '2 组（25 / 25）次');
  assert.strictEqual(P.sessionText({ values: [30], unit: 'sec' }), '1 组（30）秒');
});

test('latestSession 取最近一条', () => {
  const a = { ts: 1, stepId: 'a' }, b = { ts: 9, stepId: 'b' };
  assert.strictEqual(P.latestSession([a, b]).stepId, 'b');
  assert.strictEqual(P.latestSession([]), null);
});
