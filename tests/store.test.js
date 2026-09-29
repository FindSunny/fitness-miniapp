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
  assert.deepStrictEqual(s.steps, {}, '进度真相是"每式是否通过"这张表');
});

test('存储：进的唯一真相是"已通过表"，不再存"当前式"', () => {
  store.reset();
  // 语义变更（锁定式推进）：currentNo 不再是存储字段，改由 steps 推导
  assert.strictEqual(store.getState().steps['pushup-01'], undefined);
  store.setStepPassed('pushup-01', true);
  assert.ok(store.isStepPassed('pushup-01'));
  assert.ok(store.getState().steps['pushup-01'].passedAt > 0, '应记录通过时间');

  store.setStepPassed('pushup-01', false);
  assert.strictEqual(store.isStepPassed('pushup-01'), false, '可以取消通过（重置/调试用）');
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

test('存储：通关记里程碑，重置会清掉通关与未提交的草稿（记录保留）', () => {
  store.reset();
  assert.strictEqual(store.isCompleted('pushup'), false);

  store.completeArt('pushup');
  assert.strictEqual(store.isCompleted('pushup'), true);
  assert.ok(store.getState().arts.pushup.completedAt > 0, '应记录通关时间');

  // 重置：通关状态 + 未提交的草稿一起清，训练记录保留
  store.saveDraft('pushup-03', [30, 30]);
  store.addSession({ artId: 'pushup', stepId: 'pushup-01', no: 1, values: [50, 50, 50], tier: '升级' });
  assert.strictEqual(store.pendingSets(), 2);

  store.resetArt('pushup', ['pushup-01', 'pushup-02', 'pushup-03']);
  assert.strictEqual(store.isCompleted('pushup'), false);
  assert.strictEqual(store.getState().arts.pushup.completedAt, null);
  assert.strictEqual(store.getState().arts.pushup.lastCompletedAt, null, '重置同时清掉"最近一次通关"');
  assert.strictEqual(store.pendingSets(), 0, '重置后不该还留着"未提交的组"（否则列表会自相矛盾地显示进行中）');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '训练记录是历史，重置不清');
});

test('存储：completeArt 保留首次通关时间，复习只更新"最近一次"', () => {
  store.reset();
  store.completeArt('pushup');
  const first = store.getState().arts.pushup.completedAt;
  assert.ok(first > 0, '首次通关应记录时间');

  // 复习：追加记录 + 再次 completeArt
  store.addSession({ artId: 'pushup', stepId: 'pushup-10', no: 10, values: [10, 10], tier: '升级' });
  store.completeArt('pushup');

  const art = store.getState().arts.pushup;
  assert.strictEqual(art.completed, true, '复习不会清掉通关标记');
  assert.strictEqual(art.completedAt, first, '首次通关时间是里程碑，不被覆盖');
  assert.ok(art.lastCompletedAt >= first, '应记录最近一次通关时间');
  assert.strictEqual(store.sessionsOf('pushup').length, 1, '复习记录也要留下');
});

test('存储：调试造进度会先备份，还原后回到真实进度', () => {
  store.reset();
  store.setStepPassed('pushup-01', true);
  store.setStepPassed('pushup-02', true);

  assert.strictEqual(store.hasDebugSnapshot(), false, '没造过进度就没有备份');
  store.debugUnlockTo('pushup', 5, ['pushup-01', 'pushup-02', 'pushup-03', 'pushup-04', 'pushup-05']);
  assert.strictEqual(store.isStepPassed('pushup-01'), true);
  assert.strictEqual(store.isStepPassed('pushup-04'), true, '解锁到第 5 式 → 前 4 式记为已通过');
  assert.strictEqual(store.isStepPassed('pushup-05'), false, '第 5 式本身是当前式，不算通过');
  assert.strictEqual(store.hasDebugSnapshot(), true);

  // 再操作一次，备份不该被覆盖成调试态
  store.debugUnlockTo('pushup', 10, ['pushup-01', 'pushup-02', 'pushup-03', 'pushup-04', 'pushup-05', 'pushup-06', 'pushup-07', 'pushup-08', 'pushup-09', 'pushup-10']);
  assert.strictEqual(store.isStepPassed('pushup-09'), true);

  store.debugRestore();
  assert.strictEqual(store.isStepPassed('pushup-01'), true, '还原回备份：第 1、2 式仍是通过的');
  assert.strictEqual(store.isStepPassed('pushup-03'), false);
  assert.strictEqual(store.isStepPassed('pushup-09'), false);
  assert.strictEqual(store.hasDebugSnapshot(), false, '还原后备份清掉');
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
