/**
 * 界面质量检查单 · A 组（数字项）
 *
 * 为什么要有这一层：对比度/字号/点按区这些是**能算出来的**，不该等用户眯着眼发现。
 * 这个文件从**真实 WXSS** 里读色值和字号，按 WCAG 公式复算并断言 ——
 * 以后有人把颜色改浅、把字号改小，`npm test` 会直接红，而不是上线后被用户在健身房发现。
 *
 * 门槛（见 ACCEPTANCE.md 第五节）：
 *   Q1 正文/小字对比度 ≥ 4.5:1（WCAG AA）
 *   Q2 大字（≥46rpx）对比度 ≥ 3:1
 *   Q3 关键信息字号 ≥ 22rpx；装饰性提示 ≥ 20rpx
 *   Q4 主操作点按区 ≥ 88rpx（≈44pt）
 *
 * 白底上只有两级可读灰：比 #64748b 更浅的灰在 4.5:1 以下，所以第三级层级
 * 用**字号/字重**区分，不靠更浅的颜色（这是算出来的结论，不是审美偏好）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'miniprogram');
const FILES = {
  app: 'app.wxss',
  index: 'pages/index/index.wxss',
  art: 'pages/art/art.wxss',
  step: 'pages/step/step.wxss'
};

const W = '#ffffff';      // 卡片底
const PAGE = '#f8fafc';   // 页面底
const GREY = '#f1f5f9';   // 浅灰底

/* ---------------- WCAG 对比度 ---------------- */

function srgb(hex) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  return [0, 2, 4].map(i => parseInt(full.substr(i, 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = srgb(hex).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------- 从 WXSS 里取声明 ---------------- */

const cache = {};
function cssOf(file) {
  // 必须先去注释：否则 `/* 主按钮 */\n.btn {` 这种会被解析成
  // 选择器 = "/* 主按钮 */ .btn"，匹配不上 → 静默"跳过"（等于漏报，比报错更危险）
  if (!cache[file]) {
    cache[file] = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  }
  return cache[file];
}

/** 取某个选择器规则块里的某个属性（后出现的覆盖先出现的，跟 CSS 一致） */
function decl(file, selector, prop) {
  const src = cssOf(file);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m, found = null;
  while ((m = re.exec(src))) {
    const sels = m[1].split(',').map(s => s.trim().replace(/\s+/g, ' '));
    if (sels.indexOf(selector) < 0) continue;
    const body = m[2];
    const pm = new RegExp('(?:^|;)\\s*' + prop.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+)', 'i').exec(body);
    if (pm) found = pm[1].trim();
  }
  return found;
}

/** 把 rpx 值取出来（同一个属性里可能有多个值，取数字最大的那个） */
function rpxOf(value) {
  if (!value) return null;
  const nums = (value.match(/([\d.]+)rpx/g) || []).map(s => parseFloat(s));
  return nums.length ? Math.max.apply(null, nums) : null;
}

/** 文字色 / 底色的对比度；bg 传 null 表示"从同一条规则里读 background" */
function pairRatio(file, selector, bgOverride) {
  const fg = decl(file, selector, 'color');
  if (!fg) return { ratio: null, fg: null, bg: null, why: '没读到 color' };
  if (!/^#/.test(fg.trim())) return { ratio: null, fg: fg, bg: null, why: '非十六进制色（渐变/关键字）' };
  let bg = bgOverride;
  if (!bg) bg = decl(file, selector, 'background') || decl(file, selector, 'background-color');
  if (!bg || !/^#/.test(bg.trim())) return { ratio: null, fg: fg, bg: bg, why: '底色调不出来（继承自父级）' };
  return { ratio: contrast(fg.trim(), bg.trim()), fg: fg.trim(), bg: bg.trim(), why: '' };
}

/* ---------------- Q1 / Q2：对比度 ---------------- */

// [说明, 文件key, 选择器, 背景(hex 或 null=同规则内读), 门槛]
const CONTRAST_CASES = [
  ['页面正文',        'app',   'page',                  PAGE, 4.5],
  ['大标题 .h1',      'app',   '.h1',                   W,    3],
  ['副标题 .sub',     'app',   '.sub',                  PAGE, 4.5],
  ['次要文字 .muted', 'app',   '.muted',                W,    4.5],
  ['浅色提示 .light', 'app',   '.light',                W,    4.5],
  ['强调字 .accent',  'app',   '.accent',               W,    4.5],
  ['危险字 .danger',  'app',   '.danger',               W,    4.5],
  ['免责声明',        'app',   '.disclaimer',           PAGE, 4.5],
  ['灰色徽标',        'app',   '.badge.gray',           null, 4.5],
  ['小标签 .chip',    'app',   '.chip',                 W,    4.5],
  ['主按钮 .btn',     'app',   '.btn',                  null, 4.5],
  ['列表图例',        'art',   '.list-legend',          PAGE, 4.5],
  ['图例·未解锁',     'art',   '.list-legend .lg.locked', PAGE, 4.5],
  ['序号圆点',        'art',   '.step-no',              null, 4.5],
  ['未解锁式名',      'art',   '.step-item.locked .step-name', '#fcfcfd', 4.5],
  ['状态块·未解锁',   'art',   '.step-state.locked',    null, 4.5],
  ['状态块·已通过',   'art',   '.step-state.passed',    null, 4.5],
  ['状态块·进行中',   'art',   '.step-state.current',   null, 4.5],
  ['调试行',          'art',   '.debug-line',           W,    4.5],
  ['诊断行',          'index', '.store-diag',           null, 4.5],
  ['卡片状态·未开始', 'index', '.art-state-text.todo',  W,    4.5],
  ['卡片状态·进行中', 'index', '.art-state-text.doing', W,    4.5],
  ['卡片状态·已通关', 'index', '.art-state-text.done',  W,    4.5],
  ['卡片进度数字',    'index', '.art-state-num',        W,    4.5],
  ['图待补提示',      'index', '.fig-tag',              W,    4.5],
  ['横幅·未解锁',     'step',  '.banner.locked',        null, 4.5],
  ['横幅·进行中',     'step',  '.banner.current',       null, 4.5],
  ['横幅·已通过',     'step',  '.banner.passed',        null, 4.5],
  ['卡片小标题',      'step',  '.card-title',           W,    4.5],
  ['式号指示',        'step',  '.nav-mid',              W,    4.5],
  ['未解锁说明',      'step',  '.locked-note',          PAGE, 4.5],
  ['档位数值',        'step',  '.quick-btn .q-val',     W,    4.5],
  ['历史时间',        'step',  '.hist-time',            W,    4.5],
  ['历史成绩',        'step',  '.hist-sets',            W,    4.5]
];

test('Q1/Q2 对比度：所有文字/背景配对都达标（WCAG AA）', () => {
  const lines = [];
  const bad = [];
  CONTRAST_CASES.forEach(([name, fk, sel, bg, need]) => {
    const r = pairRatio(FILES[fk], sel, bg);
    if (r.ratio === null) { lines.push(`  ⚠️ ${name.padEnd(16)} ${sel.padEnd(30)} 跳过：${r.why}`); return; }
    const ok = r.ratio >= need;
    const mark = ok ? '✅' : '❌';
    lines.push(`  ${mark} ${r.ratio.toFixed(2).padStart(5)}:1 (需 ${need}) ${name.padEnd(16)} ${r.fg} on ${r.bg}`);
    if (!ok) bad.push(`${name}：${r.ratio.toFixed(2)}:1（需 ${need}:1）${r.fg} on ${r.bg}`);
  });
  console.log('\n  ── 界面质量检查单 · A 组（Q1/Q2 对比度）──');
  console.log(lines.join('\n'));
  assert.deepStrictEqual(bad, [], '对比度不达标：\n    ' + bad.join('\n    '));
});

/* ---------------- Q3：字号下限 ---------------- */

test('Q3 字号：关键信息 ≥22rpx、装饰性提示 ≥20rpx', () => {
  const KEY = [
    ['状态词',        'art',   '.step-state'],
    ['式名',          'art',   '.step-name'],
    ['卡片状态词',    'index', '.art-state-text'],
    ['卡片进度数字',  'index', '.art-state-num'],
    ['图例',          'art',   '.list-legend'],
    ['主按钮文字',    'app',   '.btn'],
    ['小标签',        'app',   '.chip'],
    ['档位按钮',      'step',  '.quick-btn']
  ];
  const DECOR = [
    ['状态副文案',    'art',   '.step-state .state-sub', 20],
    ['图待补提示',    'index', '.fig-tag', 20],
    ['方案号',        'step',  '.nav-mid', 22]
  ];
  const bad = [];
  KEY.forEach(([name, fk, sel]) => {
    const px = rpxOf(decl(FILES[fk], sel, 'font-size'));
    if (px === null) return;   // 用默认字号（28rpx）的不管
    if (px < 22) bad.push(`${name} ${sel} 只有 ${px}rpx（需 ≥22rpx）`);
  });
  DECOR.forEach(([name, fk, sel, need]) => {
    const px = rpxOf(decl(FILES[fk], sel, 'font-size'));
    if (px === null) return;
    if (px < need) bad.push(`${name} ${sel} 只有 ${px}rpx（需 ≥${need}rpx）`);
  });
  assert.deepStrictEqual(bad, [], '字号过小：\n    ' + bad.join('\n    '));
});

/* ---------------- Q4：主操作点按区 ---------------- */

/** 纵向 padding 合计（padding 简写的第一个值永远是垂直方向，不能取最大值） */
function paddingY(file, selector) {
  const t = rpxOf(decl(file, selector, 'padding-top'));
  const b = rpxOf(decl(file, selector, 'padding-bottom'));
  if (t !== null || b !== null) return (t || 0) + (b || 0);
  const sh = decl(file, selector, 'padding');
  if (!sh) return 0;
  // 按空格切第一个值（不能只抓带 rpx 的数字：`padding: 0 34rpx` 里的 0 没有单位，
  // 会被漏掉，于是把横向的 34 当成纵向 —— 这个 bug 让 .add-btn 被算成 156rpx）
  const first = sh.trim().split(/\s+/)[0];
  const num = parseFloat(first);
  return isNaN(num) ? 0 : num * 2;
}

/**
 * 有效点按高度 = 视觉盒高 + ::after 隐形外扩。
 * 为什么要这么算：**视觉大小和点按区是两件事**。
 * 把"上一式/下一式"这类按钮硬撑到 88rpx 会很笨重（真机反馈"太大不好看"），
 * 正确做法是视觉保持紧凑、用 ::after 上下外扩把可点区域补到 88rpx。
 * 注意：这是**静态估算**（字号 ×1.6 行高 + 纵向 padding），不是真实渲染尺寸 —— 只做下限守卫用。
 */
function hitArea(file, selector) {
  const box = Math.max(
    rpxOf(decl(file, selector, 'min-height')) || 0,
    rpxOf(decl(file, selector, 'height')) || 0,
    rpxOf(decl(file, selector, 'line-height')) || 0
  );
  const fontPx = rpxOf(decl(file, selector, 'font-size'));
  const content = box || (fontPx ? fontPx * 1.6 : 28 * 1.6);
  const visual = content + paddingY(file, selector);

  const ext = (Math.abs(rpxOf(decl(file, selector + '::after', 'top')) || 0) +
               Math.abs(rpxOf(decl(file, selector + '::after', 'bottom')) || 0));
  return { visual: Math.round(visual), ext, total: Math.round(visual + ext) };
}

test('Q4 点按区：主操作有效点按高度 ≥88rpx（视觉可小，靠隐形外扩补）', () => {
  const CASES = [
    ['主按钮 .btn',        'app',  '.btn'],
    ['记一组 .add-btn',    'step', '.add-btn'],
    ['上一式/下一式',      'step', '.nav-btn'],
    ['档位按钮 .quick-btn', 'step', '.quick-btn'],
    ['删组标签 .chip',     'app',  '.chip'],
    ['展开历史 .hist-toggle', 'step', '.hist-toggle']
  ];
  const bad = [];
  const lines = [];
  CASES.forEach(([name, fk, sel]) => {
    const a = hitArea(FILES[fk], sel);
    const ok = a.total >= 88;
    lines.push(`  ${ok ? '✅' : '❌'} 有效 ${String(a.total).padStart(3)}rpx (需 88) = 视觉 ${String(a.visual).padStart(3)} + 外扩 ${String(a.ext).padStart(2)}   ${name}`);
    if (!ok) bad.push(`${name}：有效 ${a.total}rpx（需 ≥88rpx）`);
  });
  console.log('\n  ── Q4 点按区（视觉 + 隐形外扩）──\n' + lines.join('\n'));
  assert.deepStrictEqual(bad, [], '点按区过小：\n    ' + bad.join('\n    '));
});

/* ---------------- Q6/Q7：结构性红线 ---------------- */

test('Q7 不用纯黑纯灰：正文/标题不许出现 #000 / #333 / gray', () => {
  const banned = [];
  Object.keys(FILES).forEach(k => {
    const src = cssOf(FILES[k]);
    const hits = src.match(/color\s*:\s*(#000000|#000|#333333|#333|#666|#999|black|gray|grey)\b/gi) || [];
    hits.forEach(h => banned.push(`${FILES[k]} → ${h}`));
  });
  assert.deepStrictEqual(banned, [], '出现了纯黑/纯灰：\n    ' + banned.join('\n    '));
});
