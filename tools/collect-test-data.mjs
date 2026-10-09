/**
 * 采集「真实在跑的测试」数据，供 TESTING-LIVE.html 嵌用。
 *
 *   1) 先从仓库里读用例清单（Node 6 个文件 / E2E 15 场景 / 截图 19 态）
 *   2) 再读三份真实日志（release/report/log-node.txt、log-e2e.txt、log-shots.txt）
 *   3) 脱敏：AppID、用户名绝对路径 → 打码
 *   4) 写出 release/report/testing-data.json（不入库）
 *   5) --inject：把数据写进 TESTING-LIVE.html 的 DATA 标记之间（页面是本文件的快照）
 *
 * 用法：
 *   npm test > release/report/log-node.txt          # 先跑出真实日志
 *   npm run e2e > release/report/log-e2e.txt
 *   npm run e2e:shots > release/report/log-shots.txt
 *   node tools/collect-test-data.mjs --inject
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// build-info.js 是小程序侧的 CommonJS 模块，这里借 require 读它
const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'release/report/testing-data.json');
const PAGE = path.join(ROOT, 'TESTING-LIVE.html');

const LAYERS = {
  'tests/data.test.js': { layer: 'L1', name: '数据完整性', note: '60 式的内容与合规检查' },
  'tests/data-source.test.js': { layer: 'L1b', name: '数据来源对齐', note: '每一式标准与来源快照逐条核对' },
  'tests/progress.test.js': { layer: 'L2', name: '判定逻辑', note: '纯函数：达标 / 推导 / 推荐' },
  'tests/store.test.js': { layer: 'L3', name: '本地存储', note: '进度、草稿、上限、重置' },
  'tests/page-flow.test.js': { layer: 'L4', name: '页面流程', note: '驱动真实页面代码跑一遍' },
  'tests/ui-quality.test.js': { layer: 'L4b', name: '界面质量', note: '从真实样式文件算出来的数字' }
};

/** 日志脱敏：不把 AppID 与你本机的绝对路径写进要分享的页面里 */
function scrub(text) {
  return text
    .replace(/wx[0-9a-f]{16}/gi, 'wx················')
    .replace(/[A-Za-z]:\\\\?[^ \n"']*livingThings[^ \n"']*/g, '<项目路径>')
    .replace(/[A-Za-z]:\\[^ \n"']*livingThings[^ \n"']*/g, '<项目路径>')
    .replace(/\r\n/g, '\n')
    .trim();
}

function collectNames() {
  const files = Object.keys(LAYERS).map((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const tests = [...src.matchAll(/test\((['"`])([\s\S]*?)\1/g)]
      .map((m) => m[2].replace(/\s+/g, ' ').trim());
    return { file: f, ...LAYERS[f], tests };
  });

  const e2eSrc = fs.readFileSync(path.join(ROOT, 'e2e/run.js'), 'utf8');
  const scenarios = [];
  let cur = null;
  for (const line of e2eSrc.split('\n')) {
    const st = line.match(/step\(\s*'([^']*)'/);
    if (st) { cur = { name: st[1], checks: [] }; scenarios.push(cur); continue; }
    const ck = line.match(/check\(\s*'([^']*)'/);
    if (ck && cur) cur.checks.push(ck[1]);
  }

  // 截图：19 个状态各自"怎么摆出来"（解析 STATES 数组里每个状态块）
  const shotsSrc = fs.readFileSync(path.join(ROOT, 'e2e/shots.js'), 'utf8');
  const states = parseShotStates(shotsSrc);

  const expected = (e2eSrc.match(/EXPECTED_CHECKS\s*=\s*(\d+)/) || [])[1];

  return {
    version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version,
    stamp: require(path.join(ROOT, 'miniprogram/build-info.js')).stamp,
    collectedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    node: { total: files.reduce((n, f) => n + f.tests.length, 0), files },
    e2e: { total: scenarios.reduce((n, s) => n + s.checks.length, 0), expected: expected ? Number(expected) : null, scenarios },
    shots: { total: states.length, cropTop: 48, states },
    logs: {
      node: scrub(readLog('log-node.txt')),
      e2e: scrub(readLog('log-e2e.txt')),
      shots: scrub(readLog('log-shots.txt'))
    }
  };
}

function readLog(f) {
  const p = path.join(ROOT, 'release/report', f);
  if (!fs.existsSync(p)) return `（未找到 ${f}：先跑对应命令并把输出重定向到这个文件）`;
  return fs.readFileSync(p, 'utf8');
}

/** 解析 e2e/shots.js 里 STATES 的每个状态：摆什么数据、开哪页、滚动还是点击 */
function parseShotStates(src) {
  const start = src.indexOf('const STATES = [');
  const body = src.slice(start);
  // 状态块开头可能带注释行（例如 17-home-bottom 上面有一条说明），要允许
  const hits = [...body.matchAll(/\{\s*\n(?:\s*\/\/[^\n]*\n)*\s*name:\s*'([^']+)',\s*desc:\s*'([^']+)'/g)];
  const PAGE_NAME = {
    '/pages/index/index': '首页',
    '/pages/art/art': '十式列表',
    '/pages/step/step': '动作详情页'
  };

  return hits.map((h, i) => {
    const block = body.slice(h.index, i + 1 < hits.length ? hits[i + 1].index : body.length);
    const steps = [];

    // 1) 摆数据
    let passed = (block.match(/passedAt:/g) || []).length;
    // 有些状态用 .reduce 批量生成"已通过"（例如 08-step-last 的九个），要把数组长度算进去
    if (/\.reduce\(/.test(block)) {
      const arr = block.match(/\[([^\]]*'\d\d'[^\]]*)\]/);
      if (arr) passed = Math.max(passed, (arr[1].match(/'(\d\d)'/g) || []).length);
    }
    const sessions = (block.match(/session\(/g) || []).length;
    const hasDraft = /drafts:\s*\{\s*'/.test(block);
    const completed = /completed:\s*true/.test(block);
    const bits = [];
    if (completed) bits.push('已通关');
    if (passed) bits.push('前 ' + passed + ' 式「已通过」');
    if (sessions) bits.push(sessions + ' 条历史记录');
    if (hasDraft) bits.push('一条未提交的草稿');
    steps.push('写入本地存储：' + (bits.length ? bits.join(' + ') : '全新用户（空进度）'));

    // 2) 打开哪一页
    const m = block.match(/url:\s*'([^']+)'/);
    if (m) {
      const [p, q] = m[1].split('?');
      const page = PAGE_NAME[p] || p;
      const query = (q || '').split('&').filter(Boolean).map((kv) => {
        const [k, v] = kv.split('=');
        if (k === 'artId') return { pushup: '俯卧撑', squat: '深蹲', pullup: '引体向上', legraise: '举腿', bridge: '桥', handstand: '倒立撑' }[v] || v;
        if (k === 'no') return '第 ' + v + ' 式';
        if (k === 'quick') return '极简模式';
        return k + '=' + v;
      }).join(' · ');
      steps.push('打开' + page + (query ? '（' + query + '）' : ''));
    }

    // 3) 截图前的动作
    if (/scroll:\s*\d+/.test(block)) steps.push('滚动到页面下方（' + block.match(/scroll:\s*(\d+)/)[1] + 'px）');
    if (/click:/.test(block)) steps.push('点击元素 ' + (block.match(/click:\s*'([^']+)'/) || [])[1]);
    if (/wait:/.test(block)) steps.push('额外等待 ' + (block.match(/wait:\s*(\d+)/) || [])[1] + 'ms 等渲染');

    steps.push('截图落盘 → 与基线指纹比对');
    return { name: h[1], desc: h[2], steps };
  });
}

function inject(data) {
  const html = fs.readFileSync(PAGE, 'utf8');
  // 转义 < 以免 JSON 里出现 </script> 之类的序列破坏解析
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const block = `<!-- DATA:START -->\n<script id="testdata" type="application/json">${json}</script>\n<!-- DATA:END -->`;
  const next = html.replace(/<!-- DATA:START -->[\s\S]*?<!-- DATA:END -->/, block);
  if (next === html) throw new Error('没有找到 DATA 标记，注入失败');
  fs.writeFileSync(PAGE, next, 'utf8');
  console.log(`已注入 TESTING-LIVE.html（数据 ${Math.round(json.length / 1024)} KB）`);
}

const data = collectNames();
fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2), 'utf8');

console.log(`用例清单：Node ${data.node.total} ｜ E2E ${data.e2e.total}（期望 ${data.e2e.expected}）｜ 截图 ${data.shots.total}`);
console.log('分层：' + data.node.files.map((f) => `${f.layer} ${f.tests.length}`).join(' ｜ '));
const kb = (s) => Math.round(s.length / 1024) + 'KB';
console.log(`日志：node ${kb(data.logs.node)} ｜ e2e ${kb(data.logs.e2e)} ｜ shots ${kb(data.logs.shots)}`);
console.log(`数据已写出：release/report/testing-data.json`);

if (process.argv.includes('--inject')) inject(data);
