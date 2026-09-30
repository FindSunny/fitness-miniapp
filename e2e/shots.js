/**
 * 截图 pass（与断言 pass 分离）
 *
 * 为什么分开：
 *   `npm run e2e` 负责断言（稳定）；截图只在需要证据时单独跑。
 *   每一张图都是「写状态 → reLaunch 到目标页 → 等待渲染 →（可选：滚动/点一下）→ 截图」，
 *   步骤之间互不依赖，某一张失败不影响其他张。
 *   需要下半屏证据时给状态加 `scroll: <px>`（见下面第 16/17 张）。
 *
 * 用法：
 *   npm run e2e:shots                      出图 + 与基线比对（只报告，不判失败）
 *   npm run e2e:shots -- --update-baseline 把当前这批图存成新基线
 *   npm run e2e:shots -- --strict          与基线不一致就 exit 1（发布前"冻住"用）
 * 产物：e2e/shots/*.png + e2e/shots-baseline.json（基线入库，图不入库）
 */
const fs = require('fs');
const path = require('path');
const { getMiniProgram, sleep, waitReady, retry } = require('./lib');
const { hashScreenshot, fingerprint, diffFingerprint, CROP_TOP } = require('../tools/lib/screenshot-hash.js');

const SHOTS = path.join(__dirname, 'shots');
const BASELINE = path.join(__dirname, 'shots-baseline.json');
const KEY = 'cf_state_v1';
const file = n => path.join(SHOTS, n + '.png');

const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const STRICT = process.argv.includes('--strict');

const seed = (mp, state) => mp.callWxMethod('setStorageSync', KEY, state);
const empty = () => ({ version: 2, arts: {}, sessions: [], drafts: {}, steps: {} });

// 造一些像样的历史数据
const now = Date.now();
const day = 24 * 3600 * 1000;
const session = (artId, no, values, tier, ts) => ({
  artId, stepId: `${artId}-${String(no).padStart(2, '0')}`, no, values,
  unit: 'reps', perSide: no >= 7, tier, tierIndex: 0, ts
});

const STATES = [
  {
    name: '01-home-fresh', desc: '首页 · 全新用户',
    state: empty(), url: '/pages/index/index'
  },
  {
    name: '02-art-fresh', desc: '十式列表 · 全新（第 1 式进行中，其余未解锁）',
    state: empty(), url: '/pages/art/art?artId=pushup'
  },
  {
    name: '03-art-practiced', desc: '十式列表 · 第 1 式已通过（练过 2 次）+ 第 2 式进行中（有未提交的组）',
    state: {
      version: 2, arts: {},
      sessions: [session('pushup', 1, [25, 25], '中级', now - 2 * day), session('pushup', 1, [20, 20], '初级', now - day)],
      drafts: { 'pushup-02': { values: [12, 12], ts: now } },
      steps: { 'pushup-01': { passedAt: now - 2 * day } }
    },
    url: '/pages/art/art?artId=pushup'
  },
  {
    name: '04-art-passed', desc: '十式列表 · 前三式已通过（第 4 式进行中，其余未解锁）',
    state: {
      version: 2, arts: {},
      sessions: [session('pushup', 3, [30, 30, 30], '升级', now - day)],
      drafts: {},
      steps: { 'pushup-01': { passedAt: now }, 'pushup-02': { passedAt: now }, 'pushup-03': { passedAt: now } }
    },
    url: '/pages/art/art?artId=pushup'
  },
  {
    name: '05-step-current', desc: '详情页 · 当前在练（有历史记录）',
    state: {
      version: 2, arts: {},
      sessions: [session('pushup', 1, [25, 25], '中级', now - day)],
      drafts: {}, steps: {}
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '06-step-passed', desc: '详情页 · 已通过（横幅应为绿色）',
    state: {
      version: 2, arts: {},
      sessions: [session('pushup', 1, [50, 50, 50], '升级', now - 3 * day)],
      drafts: {}, steps: { 'pushup-01': { passedAt: now - 3 * day } }
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '07-step-draft', desc: '详情页 · 有未提交的组（草稿恢复提示）',
    state: {
      version: 2, arts: {}, sessions: [],
      drafts: { 'pushup-01': { values: [20, 18], ts: now } }, steps: {}
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '08-step-last', desc: '详情页 · 第十式（九个已通过）',
    state: {
      version: 2, arts: {},
      sessions: [session('pushup', 9, [6, 6, 6], '中级', now - day)],
      drafts: {},
      steps: ['01', '02', '03', '04', '05', '06', '07', '08', '09']
        .reduce((m, n) => (m['pushup-' + n] = { passedAt: now }, m), {})
    },
    url: '/pages/step/step?artId=pushup&no=10'
  },
  {
    name: '09-home-progress', desc: '首页 · 俯卧撑已通关，推荐顺延到深蹲',
    state: {
      version: 2,
      arts: { pushup: { completed: true, completedAt: now, lastCompletedAt: now } },
      sessions: [session('pushup', 10, [10, 10], '升级', now)],
      drafts: {}, steps: {}
    },
    url: '/pages/index/index'
  },
  {
    name: '10-home-all-done', desc: '首页 · 六艺全部通关',
    state: (() => {
      const arts = {}, steps = {};
      ['pushup', 'squat', 'pullup', 'legraise', 'bridge', 'handstand'].forEach(a => {
        arts[a] = { completed: true, completedAt: now, lastCompletedAt: now };
        for (let i = 1; i <= 10; i++) steps[a + '-' + String(i).padStart(2, '0')] = { passedAt: now };
      });
      return { version: 2, arts, sessions: [session('bridge', 10, [3, 3], '升级', now)], drafts: {}, steps };
    })(),
    url: '/pages/index/index'
  },
  {
    name: '11-step-locked', desc: '详情页 · 未解锁的式（只能看，不能记）',
    state: empty(),
    url: '/pages/step/step?artId=pushup&no=3',
  },
  {
    name: '12-step-quick-tier', desc: '详情页 · 一键按【中级】填入 2 组 × 25',
    state: {
      version: 2, arts: {}, sessions: [],
      drafts: { 'pushup-01': { values: [25, 25], ts: now } }, steps: {}
    },
    url: '/pages/step/step?artId=pushup&no=1',
  },
  {
    name: '13-step-pose-big', desc: '详情页 · 点示意图看全屏大图（tap 触发）',
    state: empty(),
    url: '/pages/step/step?artId=pushup&no=1',
    tap: 'openPose'
  },
  {
    name: '14-art-gear', desc: '十式列表 · 器械说明行（引体向上：需要一根单杠）',
    state: empty(),
    url: '/pages/art/art?artId=pullup'
  },
  {
    name: '15-step-quick', desc: '详情页 · 极简模式（从首页"今天只有 10 分钟"进来）',
    state: empty(),
    url: '/pages/step/step?artId=pushup&no=1&quick=1'
  },
  // ↓ 这三张要滚到下半屏：验收第 19/36 项的视觉证据（"列表里那行内部话术没了""底部有版本号"）
  {
    name: '16-art-note-rows', desc: '十式列表滚到底 · 第 8/10 行不再有「数据待校对」红字（验收 36）',
    state: empty(),
    url: '/pages/art/art?artId=pushup',
    scroll: 2000
  },
  {
    name: '17-home-bottom', desc: '首页滚到底 · 版本号 v0.1.7（所有环境都显示，验收 19）',
    state: empty(),
    url: '/pages/index/index',
    scroll: 2000
  },
  {
    name: '18-step-note', desc: '详情页 · 数据备注改成中性琥珀色（验收 36）',
    state: empty(),
    url: '/pages/step/step?artId=pushup&no=10'
  },
  {
    name: '19-pullup-no-note', desc: '详情页 · 引体第 8 式：来源笔误已核对，备注已撤（验收 36）',
    state: (() => {
      const steps = {};
      for (let i = 1; i <= 7; i++) steps['pullup-' + String(i).padStart(2, '0')] = { passedAt: now };
      return { version: 2, arts: {}, sessions: [], drafts: {}, steps };
    })(),
    url: '/pages/step/step?artId=pullup&no=8'
  }
];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.readdirSync(SHOTS).forEach(f => fs.rmSync(path.join(SHOTS, f), { force: true }));

  console.log('→ 连接自动化服务…');
  const mp = await getMiniProgram();
  await waitReady(mp);

  const results = [];
  for (const s of STATES) {
    process.stdout.write(`  ${s.name}  ${s.desc} … `);
    try {
      await seed(mp, s.state);
      await retry(() => mp.reLaunch(s.url), 3, 800);
      await sleep(1200);                                 // 留足渲染时间
      // 有的状态需要先"点一下"才有（比如全屏大图）：直接调页面的真实处理函数
      if (s.tap) {
        try {
          await mp.evaluate(function (m) {
            const pages = getCurrentPages();
            const cur = pages[pages.length - 1];
            if (cur && typeof cur[m] === 'function') cur[m]();
          }, s.tap);
          await sleep(800);
        } catch (e) { /* 点不开就按原状态截，不影响其他张 */ }
      }
      // 需要看下半屏时给状态加 `scroll: <px>`。
      // 【修正一条旧结论】以前这里写着"截图前滚动是死路"（试过 page.scrollTop 与 wx.pageScrollTo 都截出空白），
      // 但那是**滚完立刻截图**：视图层还没重绘完，截到的自然是白板。
      // 现在实测：`wx.pageScrollTo({scrollTop, duration:0})` 之后**等 0.2 秒就够**，
      // 滚过与没滚过的图哈希稳定不同、也不会白 —— 所以下半屏（列表第 8/10 行、首页底部版本号）
      // 现在有真实截图证据了（对比见 TESTING.md「滚动截图」一节）。
      if (s.scroll) {
        await mp.evaluate(function (top) {
          wx.pageScrollTo({ scrollTop: top, duration: 0 });
        }, s.scroll);
        await sleep(700);
      }
      const r = await mp.screenshot({ path: file(s.name) });
      if (!fs.existsSync(file(s.name)) && r) fs.writeFileSync(file(s.name), r, 'base64');
      // 空图也算"成功"会骗人（踩过：pageScrollTo 之后截出一张 10KB 的白板，却报 ✓）
      const size = fs.existsSync(file(s.name)) ? fs.statSync(file(s.name)).size : 0;
      const ok = size > 15000;
      results.push({ name: s.name, ok, err: ok ? '' : `疑似空白图（${(size / 1024).toFixed(1)} KB）` });
      console.log(ok ? '✓' : `✗ 疑似空白图（${(size / 1024).toFixed(1)} KB）`);
    } catch (e) {
      results.push({ name: s.name, ok: false, err: e.message });
      console.log('✗ ' + e.message);
    }
  }

  // 收尾：还原干净状态
  await seed(mp, empty());
  await retry(() => mp.reLaunch('/pages/index/index'), 3, 800).catch(() => {});
  await mp.close().catch(() => {});

  const pass = results.filter(r => r.ok).length;
  console.log(`\n截图：${pass} / ${results.length} 张成功 → e2e/shots/`);
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name} ${r.err || ''}`));

  // ---- 视觉回归：跟基线比"行暗度指纹"（裁掉状态栏 + 容忍 1px 位移）----
  const current = {};
  results.filter(r => r.ok).forEach(r => {
    try {
      const h = hashScreenshot(file(r.name));
      const fp = fingerprint(file(r.name));
      current[r.name] = { hash: h.hash, w: h.w, h: h.h, size: h.size, fp: fp.rows, rows: fp.totalRows };
    } catch (e) {
      current[r.name] = { hash: 'ERR:' + e.message, w: 0, h: 0, size: 0, fp: '', rows: 0 };
    }
  });

  if (UPDATE_BASELINE) {
    // 有图失败时**拒绝**更新基线：否则失败那张会从基线里静默消失，
    // 下次跑就变成"新增（基线里没有）"—— 基线会慢慢变成残缺的，比没有还危险。
    // （踩过：一次 04-art-passed 超时，基线从 19 张变 18 张，命令却报"已更新"）
    if (pass !== results.length && !process.argv.includes('--force')) {
      console.error(`\n✗ 有 ${results.length - pass} 张图没拍成功，拒绝更新基线（补跑成功后重试；确要强制：加 --force）`);
      process.exit(1);
    }
    const meta = {
      note: '截图视觉基线：fp = 每行"暗像素个数"的 hex 指纹（裁掉顶部 cropTop 行）。' +
            '为什么不用整文件哈希：① 状态栏有实时时钟/电量；② 重启开发者工具后渲染会整体位移约 1px —— 都靠裁剪+指纹容忍掉。' +
            'hash 只用于"完全一致"的快路径。',
      cropTop: CROP_TOP,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      images: current
    };
    fs.writeFileSync(BASELINE, JSON.stringify(meta, null, 2) + '\n', 'utf8');
    console.log(`\n已更新视觉基线：e2e/shots-baseline.json（${Object.keys(current).length} 张，裁掉顶部 ${CROP_TOP} 行 + 1px 位移容忍）`);
    process.exit(pass === results.length ? 0 : 1);
  }

  let changed = [];
  if (fs.existsSync(BASELINE)) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    const old = base.images || {};
    const names = Object.keys(current);
    const details = [];
    names.forEach(n => {
      if (!old[n] || !old[n].fp || !current[n].fp) return;
      if (old[n].hash === current[n].hash) return;              // 完全一致，快路径
      const d = diffFingerprint(old[n].fp, current[n].fp);
      if (!d.comparable) details.push(`${n}（${d.reason}）`);
      else if (d.changed) details.push(`${n}（${d.badRows}/${d.totalRows} 行不同，最差第 ${d.worstRow} 行差 ${d.worstDelta} 像素）`);
    });
    changed = details;
    const added = names.filter(n => !old[n]);
    const removed = Object.keys(old).filter(n => !current[n]);
    console.log(`\n视觉基线比对（基线 ${base.updatedAt || '未知'}，裁掉顶部 ${base.cropTop} 行 + 容忍 1px 位移）：`);
    if (!changed.length && !added.length && !removed.length) {
      console.log(`  ✓ ${names.length} 张全部与基线一致（页面没被意外改动）`);
    } else {
      changed.forEach(d => console.log(`  ⚠ 变了：${d}\n    → 改过 UI 就是这样；**没改 UI 却变了**要人工看图（e2e/shots/）`));
      if (added.length) console.log(`  · 新增（基线里没有）：${added.join('、')} → 跑 npm run e2e:shots -- --update-baseline 收进基线`);
      if (removed.length) console.log(`  · 基线里有、这次没拍：${removed.join('、')}`);
    }
  } else {
    console.log(`\n（还没有视觉基线：跑 npm run e2e:shots -- --update-baseline 建一个）`);
  }

  const bad = pass !== results.length;
  const regression = STRICT && changed.length > 0;
  if (regression) console.log('\n✗ --strict：与基线不一致的图必须人工确认后再更新基线');
  process.exit(bad || regression ? 1 : 0);
})().catch(e => { console.error('截图 pass 失败：', e.message); process.exit(1); });
