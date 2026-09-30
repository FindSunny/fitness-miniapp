/**
 * 数据来源对齐测试：60 式标准逐条对比「来源快照」
 *
 * 为什么要有这一层：`README` 里写着"标准整理自公开资料"，但**这句话以前没人验证过** ——
 * 只要有人手抖改错一个数字，界面看起来一切正常，用户照着练就错了。
 * 这份测试把来源页面抄成快照（`tests/fixtures/39net-source.json`），逐条对齐：
 *
 *   允许的差异 = 快照里 `documentedCorrections` 列出的那几条（每条都写了为什么改）
 *   其他任何差异 = 测试红 —— 要么是真抄错了，要么是改了数据但没更新快照/说明
 *
 * 顺带把「每侧」标记和「计时/计次」单位也对齐：来源里标了（全部为每侧）的必须为 true，
 * 倒立撑前三式是秒，其余是次 —— 这两类错了，判定逻辑会把秒当次算。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ARTS, getStep } = require('../miniprogram/data/arts.js');
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '39net-source.json'), 'utf8'));
const CORRECTIONS = new Map(SRC.documentedCorrections.map(c => [c.id, c]));

const sameStd = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test('来源快照本身完整：六艺 × 十式，每式三档', () => {
  assert.strictEqual(Object.keys(SRC.arts).length, 6, '快照应含六艺');
  ARTS.forEach(a => {
    const s = SRC.arts[a.id];
    assert.ok(s, `快照缺 ${a.id}`);
    assert.strictEqual(s.steps.length, 10, `${a.id} 快照应有 10 式`);
    s.steps.forEach((std, i) => {
      assert.strictEqual(std.length, 3, `${a.id} 第 ${i + 1} 式快照应有三档`);
      std.forEach(([sets, val]) => {
        assert.ok(sets > 0 && val > 0, `${a.id} 第 ${i + 1} 式快照数值应为正数`);
      });
    });
  });
});

test('60 式标准与来源逐条对齐（差异只允许是已记录的那几条）', () => {
  const mismatches = [];
  ARTS.forEach(a => {
    const snap = SRC.arts[a.id];
    a.steps.forEach((s, i) => {
      const src = snap.steps[i];
      if (sameStd(s.std, src)) return;
      const doc = CORRECTIONS.get(s.id);
      if (doc && sameStd(s.std, doc.ourStd) && sameStd(src, doc.sourceStd)) return; // 记录在案的修正
      mismatches.push(`${s.id} ${s.name}：数据 ${JSON.stringify(s.std)} ≠ 来源 ${JSON.stringify(src)}`);
    });
  });
  assert.deepStrictEqual(mismatches, [],
    '有未记录的差异（要么抄错了，要么改了数据没更新快照）：\n    ' + mismatches.join('\n    '));
});

test('已记录的修正必须"真的在修正"（快照更新了就不该再挂着）', () => {
  // 防止一种退化：改了快照让数据"看起来对齐"，但 corrections 里还留着旧条目 ——
  // 那样这条记录就成了假的历史
  SRC.documentedCorrections.forEach(c => {
    const ours = getStep(...c.id.split(/-(?=\d)/));
    assert.ok(ours, `${c.id} 不存在`);
    assert.ok(sameStd(ours.std, c.ourStd), `${c.id} 的 ourStd 与当前数据不一致（记录过期了）`);
    assert.ok(!sameStd(c.sourceStd, c.ourStd), `${c.id} 的 sourceStd 与 ourStd 相同，不构成"修正"`);
    assert.ok(c.why && c.why.length > 10, `${c.id} 缺"为什么改"的说明`);
  });
});

test('「每侧」标记与来源一致（来源写了"全部为每侧"的，我们必须是 true）', () => {
  const bad = [];
  ARTS.forEach(a => {
    const snap = SRC.arts[a.id];
    a.steps.forEach((s, i) => {
      const want = !!snap.perSide[i];
      if (!!s.perSide !== want) bad.push(`${s.id} ${s.name}：数据 perSide=${!!s.perSide}，来源=${want}`);
    });
  });
  assert.deepStrictEqual(bad, [], '每侧标记不一致：\n    ' + bad.join('\n    '));
});

test('单位与来源一致（倒立撑前三式是秒，其余是次）', () => {
  const bad = [];
  ARTS.forEach(a => {
    const snap = SRC.arts[a.id];
    a.steps.forEach((s, i) => {
      const want = (snap.unitByStep && snap.unitByStep[String(i + 1)]) || snap.unit;
      if (s.unit !== want) bad.push(`${s.id} ${s.name}：数据 unit=${s.unit}，来源=${want}`);
    });
  });
  assert.deepStrictEqual(bad, [], '单位不一致（会把秒当次算）：\n    ' + bad.join('\n    '));
});
