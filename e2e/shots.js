/**
 * 截图 pass（与断言 pass 分离）
 *
 * 为什么分开：
 *   `npm run e2e` 负责断言（稳定）；截图只在需要证据时单独跑。
 *   每一张图都是「写状态 → reLaunch 到目标页 → 等待渲染 → 截图」，
 *   步骤之间互不依赖，某一张失败不影响其他张。
 *
 * 用法：npm run e2e:shots
 * 产物：e2e/shots/*.png
 */
const fs = require('fs');
const path = require('path');
const { getMiniProgram, sleep, waitReady, retry } = require('./lib');

const SHOTS = path.join(__dirname, 'shots');
const KEY = 'cf_state_v1';
const file = n => path.join(SHOTS, n + '.png');

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
    name: '02-art-fresh', desc: '十式列表 · 全新（第 1 式为当前）',
    state: empty(), url: '/pages/art/art?artId=pushup'
  },
  {
    name: '03-art-practiced', desc: '十式列表 · 练过但未通过 + 当前式在第 2 式',
    state: {
      version: 2, arts: { pushup: { currentNo: 2 } },
      sessions: [session('pushup', 1, [25, 25], '中级', now - 2 * day), session('pushup', 1, [20, 20], '初级', now - day)],
      drafts: {}, steps: {}
    },
    url: '/pages/art/art?artId=pushup'
  },
  {
    name: '04-art-passed', desc: '十式列表 · 前三式已通过',
    state: {
      version: 2, arts: { pushup: { currentNo: 4 } },
      sessions: [session('pushup', 3, [30, 30, 30], '升级', now - day)],
      drafts: {},
      steps: { 'pushup-01': { passedAt: now }, 'pushup-02': { passedAt: now }, 'pushup-03': { passedAt: now } }
    },
    url: '/pages/art/art?artId=pushup'
  },
  {
    name: '05-step-current', desc: '详情页 · 当前在练（有历史记录）',
    state: {
      version: 2, arts: { pushup: { currentNo: 1 } },
      sessions: [session('pushup', 1, [25, 25], '中级', now - day)],
      drafts: {}, steps: {}
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '06-step-passed', desc: '详情页 · 已通过（横幅应为绿色）',
    state: {
      version: 2, arts: { pushup: { currentNo: 3 } },
      sessions: [session('pushup', 1, [50, 50, 50], '升级', now - 3 * day)],
      drafts: {}, steps: { 'pushup-01': { passedAt: now - 3 * day } }
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '07-step-draft', desc: '详情页 · 有未提交的组（草稿恢复提示）',
    state: {
      version: 2, arts: { pushup: { currentNo: 1 } }, sessions: [],
      drafts: { 'pushup-01': { values: [20, 18], ts: now } }, steps: {}
    },
    url: '/pages/step/step?artId=pushup&no=1'
  },
  {
    name: '08-step-last', desc: '详情页 · 第十式（九个已通过）',
    state: {
      version: 2, arts: { pushup: { currentNo: 10 } },
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
      arts: { pushup: { currentNo: 10, completed: true, completedAt: now, lastCompletedAt: now } },
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
        arts[a] = { currentNo: 10, completed: true, completedAt: now, lastCompletedAt: now };
        for (let i = 1; i <= 10; i++) steps[a + '-' + String(i).padStart(2, '0')] = { passedAt: now };
      });
      return { version: 2, arts, sessions: [session('bridge', 10, [3, 3], '升级', now)], drafts: {}, steps };
    })(),
    url: '/pages/index/index'
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
      const r = await mp.screenshot({ path: file(s.name) });
      if (!fs.existsSync(file(s.name)) && r) fs.writeFileSync(file(s.name), r, 'base64');
      const ok = fs.existsSync(file(s.name));
      results.push({ name: s.name, ok });
      console.log(ok ? '✓' : '✗ 无文件');
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
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('截图 pass 失败：', e.message); process.exit(1); });
