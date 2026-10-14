/**
 * 元素点击探针：element.tap()（真实坐标手势）在当前环境到底能不能用？
 *
 * 背景（为什么值得重测）：
 *   `npm run e2e`（e2e/run.js）的全部交互都走 `evaluate + getCurrentPages()` 直接调
 *   页面处理函数 —— 导航、storage、wx API 都是真的，但 **WXML 事件绑定本身没被验证**：
 *   哪个按钮的 bindtap 漏写或拼错，主流程照样全绿（处理函数是被"直接叫起来"的）。
 *   历史上试过 element.tap()，当时的结论是"点不到"（见 TESTING.md），于是全换了函数调用。
 *   本探针在**当前**开发者工具/模拟器环境里重新验证这件事，8 个场景：
 *     P0 反例：点无绑定元素（首页标题），必须毫无反应 —— 证明点击走的是真实命中测试
 *     P1 首页第一张艺术卡 → 十式列表（bindtap=goArt，带 data-id）
 *     P2 首页「开始这一式」 → 详情页（bindtap=goMain）
 *     P3 列表第 1 行 → 详情页（bindtap=goStep，带 data-no）
 *     P4 详情页「中级」快捷档位 → 数据变化（bindtap=applyTier，不导航）
 *     P5 详情页示意图 → 全屏大图出现（bindtap=openPose，渲染层）
 *     P6 全屏大图点任意处 → 关闭（bindtap=closePose，覆盖层点击）
 *     P7 滚动到下半屏后点「记一组」 → 数据变化（验证滚动后坐标是否漂移）
 *
 * 失败时自动换通道诊断（touchstart/touchend → trigger('tap')），用来区分
 * 「手势通道不工作」与「元素没绑事件」两类根因。
 *
 * 用法：node e2e/tap-probe.js
 *   （自动化服务没起会自动执行 cli auto 拉起，与 e2e/run.js 相同）
 */
const { getMiniProgram, sleep, retry, waitReady } = require('./lib');

const KEY = 'cf_state_v1';
const seed = (mp, state) => mp.callWxMethod('setStorageSync', KEY, state);
const empty = () => ({ version: 2, arts: {}, sessions: [], drafts: {}, steps: {} });

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : '   ← ' + (detail || '')}`);
}

/** 重置成干净状态并跳到目标页 */
async function goto(mp, url) {
  await seed(mp, empty());
  await retry(async () => {
    const p = await mp.reLaunch(url);
    await p.waitFor(1100);
  }, 3, 900);
}

/** 取第 nth 个匹配元素 + 它的 offset（tap 前的诊断信息） */
async function geometry(mp, sel, nth = 0) {
  const page = await mp.currentPage();
  if (!page) return null;
  const els = await page.$$(sel);
  if (!els[nth]) return null;
  const el = els[nth];
  let off = null;
  try { off = await el.offset(); } catch (e) { off = { error: e.message }; }
  return { el, off, count: els.length };
}

/** 轮询直到 expect 通过；返回 { ok, got, at(ms) }（at = 首次通过的延迟，用于估算等待时长） */
async function pollOk(expect, timeout = 4500, stepMs = 250) {
  const t0 = Date.now();
  let last = { ok: false, got: '(无)' };
  while (Date.now() - t0 < timeout) {
    try { last = await expect(); } catch (e) { last = { ok: false, got: 'expect 抛错:' + e.message }; }
    if (last.ok) return { ok: true, got: last.got, at: Date.now() - t0 };
    await sleep(stepMs);
  }
  return { ok: false, got: last.got, at: -1 };
}

/** 失败诊断：换通道再试（touchstart/touchend → trigger('tap')），看卡在哪一环 */
async function altTry(el, expect) {
  try { await el.touchstart(); await sleep(90); await el.touchend(); } catch (e) { return 'touch 抛错:' + e.message; }
  let r = await pollOk(expect, 2500);
  if (r.ok) return 'touchstart/touchend 生效（' + r.got + '）';
  try { await el.trigger('tap'); } catch (e) { return 'touch 无效；trigger 抛错:' + e.message; }
  r = await pollOk(expect, 2500);
  return r.ok ? "touch 无效；trigger('tap') 生效（" + r.got + '）' : 'touch 与 trigger 都无效';
}

/** 核心：tap 一个元素并检查期望。before 在取几何前执行（滚动/准备数据用） */
async function probeTap(mp, opt) {
  const { url, sel, nth = 0, before, expect } = opt;
  const out = { sel, ok: false, notes: [], tapMs: null, at: null };
  await goto(mp, url);
  if (before) await before(mp);
  const g = await geometry(mp, sel, nth);
  if (!g) { out.notes.push(`找不到元素 ${sel}[${nth}]`); return out; }
  out.off = g.off; out.count = g.count;
  try {
    const t0 = Date.now();
    await g.el.tap();
    out.tapMs = Date.now() - t0;
  } catch (e) { out.notes.push('tap 抛错：' + e.message); }
  const r = await pollOk(expect);
  out.ok = r.ok; out.got = r.got; out.at = r.at;
  if (!out.ok) out.notes.push('换通道：' + await altTry(g.el, expect));
  return out;
}

const diagLine = r =>
  `[诊断] offset=${JSON.stringify(r.off)}（共 ${r.count} 个）` +
  ` tap=${r.tapMs == null ? '未发出/抛错' : r.tapMs + 'ms'} 生效延迟=${r.at == null || r.at < 0 ? '未生效' : r.at + 'ms'}`;

(async () => {
  console.log('→ 连接小程序自动化服务…');
  const mp = await getMiniProgram();
  await waitReady(mp);
  console.log('→ App 就绪，开始探针\n');

  try {
    // ---------- P0 反例：无绑定元素，点了必须没反应（负向用例：等够时间再确认） ----------
    console.log('▸ P0 反例：点无绑定元素（首页标题 .h1）');
    {
      await goto(mp, '/pages/index/index');
      const g = await geometry(mp, '.h1');
      let ok = false, detail = '';
      if (!g) { detail = '找不到 .h1'; }
      else {
        try { await g.el.tap(); } catch (e) { detail = 'tap 抛错:' + e.message; }
        await sleep(1500);
        const cur = await mp.currentPage();
        ok = !!cur && cur.path === 'pages/index/index';
        detail = cur ? 'tap 后停在 ' + cur.path : '拿不到页面';
      }
      record('P0 反例：点无绑定元素没反应（1500ms 内没跳转）', ok, detail);
    }

    // ---------- P1 首页卡片 → 十式列表 ----------
    console.log('▸ P1 首页第一张艺术卡（bindtap=goArt，data-id=pushup）');
    {
      const r = await probeTap(mp, {
        url: '/pages/index/index', sel: '.art-card', nth: 0,
        expect: async () => {
          try {
            const cur = await mp.currentPage();
            return { ok: !!cur && cur.path === 'pages/art/art', got: cur && cur.path };
          } catch (e) { return { ok: false, got: 'currentPage 抛错:' + e.message }; }
        }
      });
      console.log('  ' + diagLine(r));
      record('P1 点卡片 → 跳十式列表（导航 + data-id）', r.ok, r.notes.join('；') || ('停在 ' + r.got));
    }

    // ---------- P2 首页主按钮 → 详情页 ----------
    console.log('▸ P2 首页「开始这一式」（bindtap=goMain）');
    {
      const r = await probeTap(mp, {
        url: '/pages/index/index', sel: '.btn.primary', nth: 0,
        expect: async () => {
          try {
            const cur = await mp.currentPage();
            if (!cur || cur.path !== 'pages/step/step') return { ok: false, got: cur && cur.path };
            const d = await cur.data();
            return { ok: d.no === 1, got: '详情页 no=' + d.no };
          } catch (e) { return { ok: false, got: '读取抛错:' + e.message }; }
        }
      });
      console.log('  ' + diagLine(r));
      record('P2 点「开始这一式」→ 到详情页（导航）', r.ok, r.notes.join('；') || r.got);
    }

    // ---------- P3 列表行 → 详情页（data-no 传参） ----------
    console.log('▸ P3 十式列表第 1 行（bindtap=goStep，data-no=1）');
    {
      const r = await probeTap(mp, {
        url: '/pages/art/art?artId=pushup', sel: '.step-item', nth: 0,
        expect: async () => {
          try {
            const cur = await mp.currentPage();
            if (!cur || cur.path !== 'pages/step/step') return { ok: false, got: cur && cur.path };
            const d = await cur.data();
            return { ok: d.no === 1, got: '详情页 no=' + d.no };
          } catch (e) { return { ok: false, got: '读取抛错:' + e.message }; }
        }
      });
      console.log('  ' + diagLine(r));
      record('P3 点列表第 1 行 → 到第 1 式详情（导航 + data-no）', r.ok, r.notes.join('；') || r.got);
    }

    // ---------- P4 详情页快捷档位 → 数据变化（不导航） ----------
    console.log('▸ P4 详情页「中级」快捷档位（bindtap=applyTier，data-i=1）');
    {
      const r = await probeTap(mp, {
        url: '/pages/step/step?artId=pushup&no=1', sel: '.quick-btn', nth: 1,
        expect: async () => {
          try {
            const cur = await mp.currentPage();
            if (!cur || cur.path !== 'pages/step/step') return { ok: false, got: cur && cur.path };
            const d = await cur.data();
            const vals = (d.values || []).join(',');
            return { ok: vals === '25,25', got: 'values=[' + vals + '] tier=' + (d.result && d.result.tier) };
          } catch (e) { return { ok: false, got: '读取抛错:' + e.message }; }
        }
      });
      console.log('  ' + diagLine(r));
      record('P4 点「中级」→ 填入 2 组 × 25（数据交互）', r.ok, r.notes.join('；') || r.got);
    }

    // ---------- P5 示意图 → 全屏大图（渲染层出现） ----------
    console.log('▸ P5 详情页示意图（bindtap=openPose）');
    {
      const r = await probeTap(mp, {
        url: '/pages/step/step?artId=pushup&no=1', sel: '.pose-box', nth: 0,
        expect: async () => {
          const cur = await mp.currentPage();
          const el = cur ? await cur.$('.lightbox') : null;
          return { ok: !!el, got: el ? '大图已打开' : '大图没出现' };
        }
      });
      console.log('  ' + diagLine(r));
      record('P5 点示意图 → 全屏大图出现（渲染层）', r.ok, r.notes.join('；') || r.got);
    }

    // ---------- P6 大图任意处 → 关闭（覆盖层点击） ----------
    // 打开用 evaluate 调 openPose（已知可行），把变量隔离到「关闭点击」本身
    console.log('▸ P6 全屏大图点任意处关闭（bindtap=closePose）');
    {
      const r = await probeTap(mp, {
        url: '/pages/step/step?artId=pushup&no=1', sel: '.lightbox', nth: 0,
        before: async () => {
          await mp.evaluate(function () {
            const pages = getCurrentPages();
            const cur = pages[pages.length - 1];
            if (cur && typeof cur.openPose === 'function') cur.openPose();
          });
          await sleep(800);
        },
        expect: async () => {
          const cur = await mp.currentPage();
          const el = cur ? await cur.$('.lightbox') : null;
          return { ok: !el, got: el ? '大图还在' : '大图已关闭' };
        }
      });
      console.log('  ' + diagLine(r));
      record('P6 点大图 → 关闭（覆盖层点击）', r.ok, r.notes.join('；') || r.got);
    }

    // ---------- P7 滚动后点击（坐标漂移检验） ----------
    console.log('▸ P7 滚到下半屏后点「记一组」（bindtap=addSet）');
    {
      let inputOk = null, scrollTarget = 0;
      const r = await probeTap(mp, {
        url: '/pages/step/step?artId=pushup&no=1', sel: '.add-btn', nth: 0,
        before: async () => {
          const p = await mp.currentPage();
          const input = await p.$('.num-input');
          if (input) { await input.input('25'); await sleep(400); }
          inputOk = String((await p.data()).input) === '25';
          // 量出按钮位置，把它滚到视口 45% 处（模拟"先滚动、再点击"）
          const btn = await p.$('.add-btn');
          const off = btn ? await btn.offset() : null;
          const info = await mp.systemInfo();
          const h = (info && (info.windowHeight || info.screenHeight)) || 800;
          scrollTarget = Math.max(0, ((off && off.top) || 0) - h * 0.45);
          await mp.evaluate(function (t) { wx.pageScrollTo({ scrollTop: t, duration: 0 }); }, scrollTarget);
          await sleep(700);
        },
        expect: async () => {
          const cur = await mp.currentPage();
          const d = await cur.data();
          return { ok: (d.values || []).join(',') === '25', got: 'values=[' + (d.values || []).join(',') + ']' };
        }
      });
      console.log(`  [诊断] 输入准备=${inputOk ? 'OK' : '失败'} 滚动目标=${scrollTarget}px ` +
        `offset=${JSON.stringify(r.off)}（共 ${r.count} 个） tap=${r.tapMs == null ? '未发出/抛错' : r.tapMs + 'ms'} 生效延迟=${r.at == null || r.at < 0 ? '未生效' : r.at + 'ms'}`);
      record('P7 滚动后点「记一组」→ 记录 1 组 × 25（滚动后坐标）', r.ok && inputOk !== false,
        (inputOk ? '' : '⚠ 输入准备未成功；') + (r.notes.join('；') || r.got));
    }
  } catch (e) {
    record('探针执行未中断', false, (e && e.message) || String(e));
    console.error('\n✗ 探针出错：' + (e && e.message));
  } finally {
    await seed(mp, empty()).catch(() => {});
    await mp.close().catch(() => {});
  }

  const pass = results.filter(x => x.ok).length;
  console.log('\n' + '─'.repeat(56));
  console.log(`元素点击探针：${pass} / ${results.length} 个场景通过`);
  const failed = results.filter(x => !x.ok);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(f => console.log(`  ✗ ${f.name}  ← ${f.detail}`));
  }
  if (pass === 0) console.log('→ 结论：element.tap() 在当前环境不可用（与历史结论一致，看诊断信息定位环节）');
  else if (pass === results.length) console.log('→ 结论：element.tap() 完全可用，可以引入少量真实点击用例');
  else console.log('→ 结论：element.tap() 部分可用，逐条看 ✗ 项与诊断信息');
  process.exit(pass === results.length ? 0 : 1);
})();
