/**
 * 本地状态测试（Node 下自动走内存存储分支）
 */
const test = require('node:test');
const assert = require('node:assert');

const store = require('../miniprogram/utils/store.js');

test('存储：默认状态干净', () => {
  store.reset();
  const s = store.getState();
  assert.deepStrictEqual(s.arts, {});
  assert.deepStrictEqual(s.sessions, []);
  assert.strictEqual(store.currentNo('pushup'), 1);
});

test('存储：晋级与手动设置', () => {
  store.reset();
  assert.strictEqual(store.advance('pushup', 10), 2);
  assert.strictEqual(store.currentNo('pushup'), 2);
  store.setCurrentNo('pushup', 7);
  assert.strictEqual(store.currentNo('pushup'), 7);
  // 到顶不再前进
  store.setCurrentNo('pushup', 10);
  assert.strictEqual(store.advance('pushup', 10), 10);
});

test('存储：训练记录可追加、可按艺查询、取最近', () => {
  store.reset();
  store.addSession({ artId: 'pushup', stepId: 'pushup-01', no: 1, values: [10], tier: '初级' });
  store.addSession({ artId: 'squat', stepId: 'squat-01', no: 1, values: [12], tier: '初级' });
  assert.strictEqual(store.sessionsOf().length, 2);
  assert.strictEqual(store.sessionsOf('pushup').length, 1);
  const recent = store.recentSessions(1);
  assert.strictEqual(recent.length, 1);
  assert.ok(recent[0].ts > 0, '应自动补时间戳');
  assert.strictEqual(store.getState().arts.pushup.lastStepId, 'pushup-01');
});

test('存储：第十式达标 → 记为通关，而不是继续前进', () => {
  store.reset();
  store.setCurrentNo('pushup', 10);
  assert.strictEqual(store.currentNo('pushup'), 10);
  assert.strictEqual(store.isCompleted('pushup'), false);

  store.completeArt('pushup');
  assert.strictEqual(store.isCompleted('pushup'), true);
  assert.ok(store.getState().arts.pushup.completedAt > 0, '应记录通关时间');
  assert.strictEqual(store.currentNo('pushup'), 10, '通关后仍停在第 10 式');

  store.resetArt('pushup');
  assert.strictEqual(store.currentNo('pushup'), 1);
  assert.strictEqual(store.isCompleted('pushup'), false);
  assert.strictEqual(store.getState().arts.pushup.completedAt, null);
  assert.strictEqual(store.getState().arts.pushup.lastCompletedAt, null, '重置同时清掉"最近一次通关"');
});

test('存储：completeArt 保留首次通关时间，复习只更新"最近一次"', () => {
  store.reset();
  store.setCurrentNo('pushup', 10);
  store.completeArt('pushup');
  const first = store.getState().arts.pushup.completedAt;
  assert.ok(first > 0, '首次通关应记录时间');

  // 复习：追加记录 + 再次 completeArt + 试图 advance
  store.addSession({ artId: 'pushup', stepId: 'pushup-10', no: 10, values: [10, 10], tier: '升级' });
  store.completeArt('pushup');
  store.advance('pushup', 10);

  const art = store.getState().arts.pushup;
  assert.strictEqual(art.completed, true, '复习不会清掉通关标记');
  assert.strictEqual(art.completedAt, first, '首次通关时间是里程碑，不被覆盖');
  assert.ok(art.lastCompletedAt >= first, '应记录最近一次通关时间');
  assert.strictEqual(store.currentNo('pushup'), 10, '通关后 advance 不应改式号');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '复习记录也要留下');
});

test('存储：草稿——每组即时落盘、可恢复、提交后清除', () => {
  store.reset();
  assert.strictEqual(store.pendingSets(), 0, '初始没有未提交的组');

  store.saveDraft('pushup-01', [25]);
  assert.deepStrictEqual(store.getDraft('pushup-01').values, [25]);
  assert.strictEqual(store.pendingSets(), 1);

  store.saveDraft('pushup-01', [25, 25]);
  assert.strictEqual(store.pendingSets(), 2, '再记一组应累加');

  // 提交：写正式记录 + 清草稿
  store.addSession({ artId: 'pushup', stepId: 'pushup-01', no: 1, values: [25, 25], tier: '中级' });
  store.clearDraft('pushup-01');
  assert.strictEqual(store.getDraft('pushup-01'), null);
  assert.strictEqual(store.pendingSets(), 0);
  assert.strictEqual(store.sessionsOf('pushup').length, 1);

  // 传空数组等于清除
  store.saveDraft('squat-01', [10]);
  store.saveDraft('squat-01', []);
  assert.strictEqual(store.getDraft('squat-01'), null);
  assert.strictEqual(store.pendingList().length, 0);
});

test('存储：记录上限 500 条，防止无限增长', () => {
  store.reset();
  for (let i = 0; i < 520; i++) {
    store.addSession({ artId: 'pushup', stepId: 'pushup-01', no: 1, values: [1], ts: i + 1 });
  }
  const s = store.getState();
  assert.strictEqual(s.sessions.length, 500);
  assert.strictEqual(s.sessions[0].ts, 21); // 保留的是最后 500 条
});
