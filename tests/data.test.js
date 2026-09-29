/**
 * 数据完整性测试：把"数据错了"这类问题挡在提交前
 * 运行：npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { ARTS, TIER_NAMES, ART_MAP, getArt, getStep, getStepById, getNextStep } = require('../miniprogram/data/arts.js');

const ASSETS = path.join(__dirname, '..', 'miniprogram', 'assets', 'movements');
const ROOT = path.join(__dirname, '..');
const EXPECTED_ARTS = [
  ['pushup', '俯卧撑'], ['squat', '深蹲'], ['pullup', '引体向上'],
  ['legraise', '举腿'], ['bridge', '桥'], ['handstand', '倒立撑']
];

test('构建标记：build-info 的 version 必须与 package.json 一致', () => {
  // 踩过：两处各写一个版本号，结果 package.json 是 0.1.4、界面记录里是 0.1.0
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
  const build = require('../miniprogram/build-info.js');
  assert.strictEqual(build.version, pkg.version,
    `build-info.js 的 version(${build.version}) 应等于 package.json 的 version(${pkg.version})，跑 npm run stamp 可自动同步`);
  assert.match(build.stamp, /^\d{4}-\d{2}-\d{2}\.\d+$/, 'stamp 形如 2026-09-29.8（发布时用来确认手机上是新包）');
});

test('六艺齐全，顺序与名称正确', () => {
  assert.strictEqual(ARTS.length, 6);
  EXPECTED_ARTS.forEach(([id, name], i) => {
    assert.strictEqual(ARTS[i].id, id);
    assert.strictEqual(ARTS[i].name, name);
    assert.strictEqual(ARTS[i].order, i + 1);
  });
});

test('每艺都是 10 式，式号连续', () => {
  ARTS.forEach(art => {
    assert.strictEqual(art.steps.length, 10, `${art.name} 应有 10 式`);
    art.steps.forEach((s, i) => assert.strictEqual(s.no, i + 1, `${art.name} 式号应连续`));
  });
});

test('全部动作 id 唯一（60 个）', () => {
  const ids = [];
  ARTS.forEach(a => a.steps.forEach(s => ids.push(s.id)));
  assert.strictEqual(ids.length, 60);
  assert.strictEqual(new Set(ids).size, 60);
});

test('每式都有三档标准，且数值单调不减', () => {
  ARTS.forEach(art => art.steps.forEach(s => {
    assert.strictEqual(s.unit === 'sec' ? 'sec' : s.unit, s.unit);
    assert.deepStrictEqual(
      s.std.map(x => x.length), [2, 2, 2],
      `${s.id} 每档标准应为 [组数, 数值]`
    );
    const vals = s.std.map(x => x[1]);
    assert.ok(vals[0] <= vals[1] && vals[1] <= vals[2], `${s.id} 标准应递增，实际 ${vals}`);
    s.std.forEach(([sets, value]) => {
      assert.ok(sets >= 1, `${s.id} 组数应 ≥1`);
      assert.ok(value > 0, `${s.id} 数值应 >0`);
    });
  }));
});

test('单位只允许 reps / sec', () => {
  ARTS.forEach(a => a.steps.forEach(s => {
    assert.ok(['reps', 'sec'].includes(s.unit), `${s.id} 单位非法: ${s.unit}`);
  }));
});

test('倒立撑前三式是计时（秒），其余都是计次', () => {
  [1, 2, 3].forEach(no => assert.strictEqual(getStep('handstand', no).unit, 'sec'));
  [4, 5, 6].forEach(no => assert.strictEqual(getStep('handstand', no).unit, 'reps'));
  ARTS.filter(a => a.id !== 'handstand').forEach(a =>
    a.steps.forEach(s => assert.strictEqual(s.unit, 'reps', `${s.id} 应为计次`)));
});

test('偏重/单臂类动作标记为每侧', () => {
  const perSide = (artId, nos) => nos.forEach(no =>
    assert.strictEqual(getStep(artId, no).perSide, true, `${artId} 第${no}式 应每侧`));
  perSide('pushup', [7, 8, 9, 10]);
  perSide('squat', [7, 8, 9, 10]);
  perSide('pullup', [7, 8, 9, 10]);
  perSide('handstand', [7, 8, 9, 10]);
  // 前面的式子不应带每侧
  ['pushup', 'squat', 'pullup'].forEach(id =>
    [1, 2, 3, 4, 5, 6].forEach(no =>
      assert.strictEqual(getStep(id, no).perSide, false, `${id} 第${no}式 不该每侧`)));
});

test('引用到的示意图文件必须真实存在', () => {
  const missing = [];
  ARTS.forEach(a => a.steps.forEach(s => {
    if (s.art && !fs.existsSync(path.join(ASSETS, `${s.art}.png`))) missing.push(s.art);
  }));
  assert.deepStrictEqual(missing, [], `缺少图片: ${missing.join(', ')}`);
});

test('俯卧撑十式图已画全（MVP 主线）', () => {
  for (let no = 1; no <= 10; no++) {
    const s = getStep('pushup', no);
    assert.ok(s.art, `俯卧撑第${no}式缺图`);
    assert.ok(fs.existsSync(path.join(ASSETS, `${s.art}.png`)));
  }
});

test('六艺都有首页封面图', () => {
  ARTS.forEach(a => {
    const f = path.join(ASSETS, `art-${a.id}.png`);
    assert.ok(fs.existsSync(f), `缺封面图: art-${a.id}.png`);
  });
});

test('存疑数据必须写明 note（不允许悄悄改数）', () => {
  assert.ok(getStep('pullup', 8).note, '引体第8式标准被修正过，必须带 note');
  assert.ok(getStep('pushup', 10).note, '俯卧撑第10式标准存疑，必须带 note');
  ARTS.forEach(a => a.steps.forEach(s => {
    if (s.note) assert.ok(s.note.length > 8, `${s.id} 的 note 太短，说明不清`);
  }));
});

test('数据里不能出现医疗类表述', () => {
  const banned = ['治疗', '康复', '矫正', '疗效', '治愈'];
  ARTS.forEach(a => a.steps.forEach(s => {
    const text = [s.name, s.cue || '', s.note || ''].join(' ');
    banned.forEach(w => assert.ok(!text.includes(w), `${s.id} 含禁用词「${w}」`));
  }));
});

test('查询 API 正常', () => {
  assert.strictEqual(getArt('pushup').name, '俯卧撑');
  assert.strictEqual(getArt('nope'), null);
  assert.strictEqual(getStep('pushup', 1).name, '墙壁俯卧撑');
  assert.strictEqual(getStepById('bridge-10').name, '铁板桥');
  assert.strictEqual(getNextStep('pushup', 1).name, '上斜俯卧撑');
  assert.strictEqual(getNextStep('pushup', 10), null);
  assert.strictEqual(Object.keys(ART_MAP).length, 6);
  assert.deepStrictEqual(TIER_NAMES, ['初级', '中级', '升级']);
});
