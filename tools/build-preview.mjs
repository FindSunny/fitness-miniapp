/**
 * 生成网页版预览（手机尺寸、可点击交互）
 *
 * 关键点：预览不复制逻辑，而是把小程序真实的
 *   miniprogram/data/arts.js  和  miniprogram/utils/progress.js
 * 源码注入页面里执行 —— 预览里看到的行为 = 小程序里的行为。
 *
 * 用法：node tools/build-preview.mjs
 * 产物：preview/index.html（双击即可打开，支持 #/art/pushup 这类深链）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const ARTS_SRC = read('miniprogram/data/arts.js');
const PROGRESS_SRC = read('miniprogram/utils/progress.js');

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>六艺十式 · 网页预览</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    background: #e9eef5; padding: 28px 16px;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #111827;
  }
  .head { text-align: center; }
  .head h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
  .head p { margin: 6px 0 0; font-size: 13px; color: #64748b; }

  /* ---- 手机壳 ---- */
  .phone {
    position: relative; width: 375px; height: 812px; flex: none;
    background: #f8fafc; border-radius: 42px; overflow: hidden;
    box-shadow: 0 24px 60px rgba(15,23,42,.22), 0 0 0 10px #0f172a;
  }
  .statusbar {
    height: 44px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 22px; font-size: 12px; font-weight: 600; color: #0f172a; background: #fff;
  }
  .navbar {
    height: 44px; background: #fff; border-bottom: 1px solid #eef2f7;
    display: flex; align-items: center; padding: 0 12px; position: relative;
  }
  .navbar .back { font-size: 20px; color: #334155; width: 32px; cursor: pointer; }
  .navbar .title { position: absolute; left: 0; right: 0; text-align: center; font-size: 15px; font-weight: 600; }
  .screen { position: absolute; inset: 88px 0 0 0; overflow-y: auto; padding: 16px 16px 40px; display: none; }
  .screen.active { display: block; }

  /* ---- 通用样式（对齐 app.wxss，rpx/2 = px） ---- */
  .h1 { font-size: 23px; font-weight: 700; letter-spacing: .5px; }
  .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 12px; }
  .card-title { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  .badge { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #eff6ff; color: #2563eb; }
  .badge.gray { background: #f1f5f9; color: #64748b; }
  .accent { color: #2563eb; } .muted { color: #64748b; } .light { color: #94a3b8; } .danger { color: #dc2626; }
  .hr { height: 1px; background: #e2e8f0; margin: 12px 0; }
  .row-between { display: flex; align-items: flex-start; justify-content: space-between; }
  .btn { margin-top: 12px; background: #111827; color: #fff; border-radius: 8px; font-size: 15px; line-height: 44px; text-align: center; cursor: pointer; }
  .btn.primary { background: #2563eb; }
  .btn.ghost { background: #fff; color: #111827; border: 1px solid #cbd5e1; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155; margin: 4px 6px 0 0; cursor: pointer; }
  .chip.on { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
  .disclaimer { margin-top: 20px; font-size: 11px; color: #94a3b8; line-height: 1.7; }

  .stat-row { display: flex; margin-top: 12px; }
  .stat { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; }
  .stat + .stat { margin-left: 10px; }
  .stat-num { font-size: 22px; font-weight: 700; }
  .sec-title { margin: 20px 0 4px; font-size: 16px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .art-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; cursor: pointer; }
  .art-card .art-img { width: 100%; height: 80px; background: #f8fafc; border-radius: 6px; object-fit: contain; }
  .art-name { font-size: 16px; font-weight: 700; margin-top: 6px; }
  .bar { height: 4px; background: #eef2f7; border-radius: 999px; margin-top: 8px; overflow: hidden; }
  .bar-in { height: 100%; background: #2563eb; }

  .tagline { margin-top: 8px; padding: 8px 10px; background: #eff6ff; color: #1d4ed8; border-radius: 6px; font-size: 12px; }
  .progress-card { margin-top: 12px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
  .progress-card.is-done { background: #f0fdf4; border-color: #86efac; }
  .progress-label { font-size: 15px; font-weight: 700; }
  .progress-card .bar { height: 8px; margin-top: 9px; }
  .done-tag { color: #15803d; }
  .step-item { display: flex; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #e2e8f0; border-radius: 9px; padding: 11px; margin-top: 8px; cursor: pointer; }
  .step-item.done { border-left-color: #16a34a; background: #fbfefc; }
  .step-item.current { border-left-color: #2563eb; border-color: #bfdbfe; background: #f8fbff; }
  .step-no { width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: #f1f5f9; color: #94a3b8; font-size: 12px; font-weight: 700; flex: none; }
  .step-item.done .step-no { background: #16a34a; color: #fff; }
  .step-item.current .step-no { background: #2563eb; color: #fff; }
  .step-body { flex: 1; margin-left: 10px; min-width: 0; }
  .step-name { font-size: 15px; font-weight: 700; }
  .step-state { flex: none; margin-left: 6px; font-size: 11px; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
  .step-state.passed { color: #15803d; background: #dcfce7; }
  .step-state.practiced { color: #0369a1; background: #e0f2fe; }
  .step-state.current { color: #1d4ed8; background: #dbeafe; font-weight: 700; }
  .step-state.todo { color: #94a3b8; background: #f1f5f9; }
  .final-tip { margin-top: 8px; padding: 9px 11px; background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; border-radius: 7px; font-size: 12px; line-height: 1.6; }
  .art-card.is-done { border-color: #86efac; background: #f7fef9; }
  .art-card.is-done .bar-in { background: #16a34a; }
  .done-text { font-size: 11px; font-weight: 700; color: #15803d; }
  .card.all-done { background: #f0fdf4; border-color: #86efac; }
  .all-done-title { font-size: 17px; font-weight: 700; color: #15803d; }

  .pose-box { position: relative; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
  .pose { width: 100%; height: 190px; object-fit: contain; }
  .pose-empty { height: 190px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border-radius: 6px; }
  .view-tag { position: absolute; right: 14px; top: 14px; font-size: 10px; color: #64748b; background: #f1f5f9; padding: 2px 7px; border-radius: 999px; }
  .tier-row { display: flex; align-items: center; padding: 9px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .tier-row:last-child { border-bottom: none; }
  .tier-row.hit .tier-name { color: #2563eb; font-weight: 700; }
  .tier-name { width: 60px; color: #334155; }
  .tier-val { flex: 1; }
  .tier-flag { font-size: 11px; color: #2563eb; }
  .input-row { display: flex; align-items: center; }
  .num-input { flex: 1; height: 42px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; padding: 0 12px; font-size: 15px; font-family: inherit; }
  .add-btn { margin-left: 10px; height: 42px; line-height: 42px; padding: 0 17px; background: #111827; color: #fff; border-radius: 7px; font-size: 14px; cursor: pointer; }
  .verdict { margin-top: 10px; padding: 10px; background: #f8fafc; border-radius: 7px; font-size: 13px; }
  .nav-row { display: flex; margin-top: 12px; gap: 10px; }
  .nav-row .btn { flex: 1; margin-top: 0; }

  /* ---- 工具栏 ---- */
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 560px; }
  .tool { padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid #cbd5e1; font-size: 13px; cursor: pointer; }
  .tool.on { background: #111827; color: #fff; border-color: #111827; }
  .note { font-size: 12px; color: #64748b; text-align: center; max-width: 520px; line-height: 1.7; }

  /* ---- 弹窗 ---- */
  .mask { position: absolute; inset: 0; background: rgba(15,23,42,.45); display: none; align-items: center; justify-content: center; z-index: 20; }
  .mask.show { display: flex; }
  .dialog { width: 272px; background: #fff; border-radius: 14px; overflow: hidden; text-align: center; }
  .dialog .dt { padding: 20px 18px 6px; font-size: 16px; font-weight: 700; }
  .dialog .dc { padding: 0 18px 18px; font-size: 13px; color: #475569; line-height: 1.7; }
  .dialog .da { display: flex; border-top: 1px solid #eef2f7; }
  .dialog .da div { flex: 1; padding: 12px; font-size: 15px; cursor: pointer; }
  .dialog .da div + div { border-left: 1px solid #eef2f7; color: #2563eb; font-weight: 600; }
</style>
</head>
<body>

<div class="head">
  <h1>六艺十式 · 网页预览</h1>
  <p>手机尺寸交互预览 v0.1 ｜ 点卡片进十式，点式进详情，可以真的记录并判定晋级</p>
</div>

<div class="toolbar">
  <div class="tool" onclick="go('index')">首页</div>
  <div class="tool" onclick="go('art','pushup')">俯卧撑十式</div>
  <div class="tool" onclick="go('step','pushup',5)">标准俯卧撑</div>
  <div class="tool" onclick="go('step','handstand',1)">计时类（秒）</div>
  <div class="tool" onclick="go('art','bridge')">无图式样</div>
  <div class="tool" onclick="resetAll()">清空记录</div>
</div>

<div class="phone">
  <div class="statusbar"><span>9:41</span><span>●●● ⌁ ▮</span></div>
  <div class="navbar">
    <div class="back" id="back" style="visibility:hidden" onclick="go('index')">‹</div>
    <div class="title" id="navTitle">六艺十式</div>
  </div>

  <div class="screen" id="s-index"></div>
  <div class="screen" id="s-art"></div>
  <div class="screen" id="s-step"></div>

  <div class="mask" id="mask">
    <div class="dialog">
      <div class="dt" id="dt"></div>
      <div class="dc" id="dc"></div>
      <div class="da">
        <div onclick="closeDialog()" id="dCancel">留在本式</div>
        <div onclick="confirmDialog()" id="dOk">进入下一式</div>
      </div>
    </div>
  </div>
</div>

<div class="note">
  预览用的是小程序里<b>同一套</b> data/arts.js 与 utils/progress.js（源码注入执行），
  不是另写一遍 —— 所以判定结果与真机一致。<br>
  地址栏支持深链，例如 <code>#/step/pushup/5</code>。
</div>

<script>
/* ========== 1. 注入小程序的真实模块（同一份源码） ========== */
var __mods = {};
function __load(id, src, req) {
  var module = { exports: {} };
  var fn = new Function('module', 'exports', 'require', src + '\\n//# sourceURL=' + id);
  fn(module, module.exports, req);
  __mods[id] = module.exports;
  return module.exports;
}
var ARTS_MOD = __load('data/arts.js', ${JSON.stringify(ARTS_SRC)}, function (id) {
  throw new Error('unexpected require in arts.js: ' + id);
});
var PROG_MOD = __load('utils/progress.js', ${JSON.stringify(PROGRESS_SRC)}, function (id) {
  if (id.indexOf('arts') >= 0) return ARTS_MOD;
  throw new Error('unexpected require in progress.js: ' + id);
});

/* ========== 2. 预览用的"本地存储"（等价于 utils/store.js） ========== */
var KEY = 'cf_preview_state_v1';
function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { arts: {}, sessions: [] }; }
  catch (e) { return { arts: {}, sessions: [] }; }
}
function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
var store = loadState();
function currentNo(artId) { return (store.arts[artId] && store.arts[artId].currentNo) || 1; }
function isCompleted(artId) { return !!(store.arts[artId] && store.arts[artId].completed); }
function passedMap() { return store.steps || {}; }
function isPassed(stepId) { return !!passedMap()[stepId]; }
function setPassed(stepId) {
  store.steps = store.steps || {};
  store.steps[stepId] = { passedAt: Date.now() };
  saveState(store);
}
function passedCountOf(art) {
  return art.steps.filter(function (s) { return isPassed(s.id); }).length;
}
function allPassed(art) {
  return art.steps.every(function (s) { return isPassed(s.id); });
}
function completeArt(artId) {
  store.arts[artId] = Object.assign({}, store.arts[artId], { completed: true, completedAt: Date.now() });
  saveState(store);
}

/* ========== 3. 渲染 ========== */
var screen = 'index', artId = 'pushup', no = 1, values = [];
var pendingAdvance = null;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderIndex() {
  var sessions = store.sessions || [];
  // 推荐逻辑与小程序共用同一个纯函数：跳过已通关的艺
  var rec = PROG_MOD.recommend(ARTS_MOD.ARTS, {
    sessions: sessions,
    currentNoOf: function (id) { return currentNo(id); },
    isCompleted: function (id) { return isCompleted(id); }
  });
  var completedCount = ARTS_MOD.ARTS.filter(function (a) { return isCompleted(a.id); }).length;

  var mainCard = '';
  if (rec.mode === 'all-done') {
    mainCard =
      '<div class="card all-done">' +
        '<div class="all-done-title">六艺十式 · 全部通关</div>' +
        '<div class="muted" style="font-size:12px;margin-top:4px">60 式全部达标。想继续可以任选一艺复习，或重置某个艺重新走一遍。</div>' +
        '<div class="row-between" style="margin-top:10px">' +
          '<span class="done-text" style="font-size:13px">已通关 ' + completedCount + ' / 6 艺</span>' +
          '<span class="light" style="font-size:11px">点下方任意一艺即可复习</span>' +
        '</div>' +
      '</div>';
  } else {
    mainCard =
      '<div class="card">' +
        '<div class="row-between"><div>' +
          '<div class="light" style="font-size:11px">' + (rec.mode === 'continue' ? '继续训练' : '接着练') + '</div>' +
          '<div style="font-size:18px;font-weight:700;margin-top:3px">' + esc(rec.art.name) + ' · 第 ' + rec.no + ' 式</div>' +
          '<div class="muted" style="font-size:12px">' + esc(rec.step.name) + '</div>' +
        '</div><div class="badge">≤ 10 分钟</div></div>' +
        '<div class="muted" style="font-size:12px;margin-top:7px">' + esc(PROG_MOD.formatStdLine(rec.step)) + '</div>' +
        '<div class="btn primary" onclick="go(\\'step\\',\\'' + rec.art.id + '\\',' + rec.no + ')">开始这一式</div>' +
        '<div class="light" style="font-size:11px;margin-top:6px">' + esc(rec.reason) + '</div>' +
      '</div>';
  }

  var cards = ARTS_MOD.ARTS.map(function (a) {
    var cur = currentNo(a.id);
    var completed = isCompleted(a.id);
    var passedCount = passedCountOf(a);
    var st = PROG_MOD.artStatus(a, { currentNo: cur, passedCount: passedCount, completed: completed });
    var drawn = a.steps.filter(function (s) { return s.art && s.art.indexOf('mov-') === 0; }).length;
    return '<div class="art-card' + (completed ? ' is-done' : '') + '" onclick="go(\\'art\\',\\'' + a.id + '\\')">' +
      '<img class="art-img" src="../miniprogram/assets/movements/art-' + a.id + '.png" alt="">' +
      '<div class="art-name">' + esc(a.name) + '</div>' +
      '<div class="light" style="font-size:11px">' + esc(a.en) + ' · ' + esc(a.focus) + '</div>' +
      '<div class="muted" style="font-size:11px;margin-top:4px">' + esc(a.tagline) + '</div>' +
      '<div class="bar"><div class="bar-in" style="width:' + st.percent + '%"></div></div>' +
      '<div class="row-between" style="margin-top:4px">' +
        (completed
          ? '<span class="done-text">已通关 ✓</span>'
          : '<span class="accent" style="font-size:11px">' + esc(st.label) + '</span>') +
        '<span class="light" style="font-size:10px">图 ' + drawn + '/10</span>' +
      '</div></div>';
  }).join('');

  document.getElementById('s-index').innerHTML =
    '<div class="h1">六艺十式</div>' +
    '<div class="sub">六个动作 · 每个十式 · 达到标准才进下一式</div>' +
    mainCard +
    '<div class="stat-row">' +
      '<div class="stat"><div class="stat-num">' + PROG_MOD.countRecentDays(sessions, 7) + '</div><div class="light" style="font-size:11px">近 7 天训练天数</div></div>' +
      '<div class="stat"><div class="stat-num">' + sessions.length + '</div><div class="light" style="font-size:11px">累计记录组次</div></div>' +
    '</div>' +
    '<div class="sec-title">六艺</div>' +
    '<div class="grid">' + cards + '</div>' +
    '<div class="disclaimer">本小程序是训练记录工具，动作标准与要点仅供健身参考，不构成医疗或康复建议；如有伤病请先咨询医生。动作示意图为自绘，书籍文字与插图版权归原作者及出版方所有。</div>';
}

function renderArt() {
  var art = ARTS_MOD.getArt(artId);
  var cur = currentNo(art.id);
  var completed = isCompleted(art.id);
  var st = PROG_MOD.artStatus(art, { currentNo: cur, passedCount: passedCountOf(art), completed: completed });
  var states = PROG_MOD.stepStates(art, {
    currentNo: cur,
    passed: passedMap(),
    completed: completed,
    sessions: (store.sessions || []).filter(function (x) { return x.artId === art.id; })
  });

  var rows = art.steps.map(function (s, idx) {
    var st = states[idx];
    var state = st.state;
    return '<div class="step-item ' + state + '" onclick="go(\\'step\\',\\'' + art.id + '\\',' + s.no + ')">' +
      '<div class="step-no">' + (state === 'passed' ? '✓' : s.no) + '</div>' +
      '<div class="step-body">' +
        '<div class="step-name">' + esc(s.name) +
          (s.perSide ? ' <span class="badge gray" style="margin-left:5px">每侧</span>' : '') +
          (s.unit === 'sec' ? ' <span class="badge gray" style="margin-left:5px">按秒</span>' : '') +
          (st.isCurrent ? ' <span class="badge" style="margin-left:5px">当前</span>' : '') + '</div>' +
        '<div class="muted" style="font-size:11px;margin-top:3px">' + esc(PROG_MOD.formatStdLine(s)) + '</div>' +
        (st.lastTier ? '<div class="light" style="font-size:10px;margin-top:2px">最近：' + esc(st.lastTier) + '</div>' : '') +
        (s.note ? '<div class="danger" style="font-size:10px;margin-top:2px">数据待校对：' + esc(s.note) + '</div>' : '') +
      '</div>' +
      '<div class="step-state ' + state + '">' + esc(st.stateText) + '</div>' +
    '</div>';
  }).join('');

  document.getElementById('s-art').innerHTML =
    '<div class="h1">' + esc(art.name) + '</div>' +
    '<div class="sub">' + esc(art.en) + ' · 主练 ' + esc(art.focus) + '</div>' +
    '<div class="tagline">' + esc(art.tagline) + '</div>' +
    '<div class="progress-card' + (completed ? ' is-done' : '') + '">' +
      '<div class="row-between">' +
        '<div class="progress-label">' + (completed ? '<span class="done-tag">已通关</span>' : esc(st.label)) + '</div>' +
        '<div class="muted" style="font-size:12px">已完成 ' + st.done + ' / ' + st.total + ' 式</div>' +
      '</div>' +
      '<div class="bar"><div class="bar-in" style="width:' + st.percent + '%"></div></div>' +
      '<div class="row-between" style="margin-top:8px">' +
        '<span class="light" style="font-size:11px">' +
          (completed ? '十式全部达标，可以换下一艺了' : '达到「升级」标准后自动进入下一式') + '</span>' +
        '<span class="chip" onclick="resetArt()">重置</span>' +
      '</div>' +
    '</div>' + rows +
    '<div class="disclaimer">标准整理自公开中文资料，各版本记载略有差异，仅供参考。</div>';
}

function renderStep() {
  var art = ARTS_MOD.getArt(artId);
  var step = ARTS_MOD.getStep(artId, no);
  var result = PROG_MOD.evaluate(step, values);
  var tiers = PROG_MOD.tiersOf(step).map(function (t, i) {
    return '<div class="tier-row ' + (i === result.tierIndex ? 'hit' : '') + '">' +
      '<span class="tier-name">' + t.tier + '</span>' +
      '<span class="tier-val">' + esc(PROG_MOD.formatTier(t)) + '</span>' +
      '<span class="tier-flag">' + (i <= result.tierIndex ? '已达成' : '') + '</span></div>';
  }).join('');

  var setChips = values.map(function (v, i) {
    return '<span class="chip on" onclick="removeSet(' + i + ')">第 ' + (i + 1) + ' 组 ' + v + PROG_MOD.unitLabel(step.unit) + ' ×</span>';
  }).join('') + (values.length ? '<span class="chip" onclick="clearSets()">清空</span>' : '');

  var verdict = values.length
    ? '<div class="verdict"><div class="accent">' + esc(PROG_MOD.tierText(result)) + '</div>' +
      '<div class="muted" style="margin-top:3px">' + esc(PROG_MOD.gapText(result)) + '</div></div>'
    : '';

  var viewText = step.view === 'top' ? '俯视（从上往下看）' : (step.view === 'front' ? '正视' : '侧视');
  var isLast = step.no === art.steps.length;
  var completed = isCompleted(art.id);
  var pose = step.art
    ? '<img class="pose" src="../miniprogram/assets/movements/' + step.art + '.png" alt="">'
    : '<div class="pose-empty"><div class="light">示意图待补</div><div class="light" style="font-size:10px;margin-top:4px">已有名称与标准，图后续补齐</div></div>';

  document.getElementById('s-step').innerHTML =
    '<div class="pose-box">' + pose + '<div class="view-tag">' + viewText + '</div></div>' +
    '<div class="h1" style="margin-top:12px">' + esc(step.name) + '</div>' +
    '<div class="sub">' + esc(art.name) + ' · 第 ' + step.no + ' / ' + art.steps.length + ' 式 · ' + esc(step.en) + '</div>' +
    '<div style="margin-top:6px">' +
      (step.perSide ? '<span class="badge">每侧计数</span>' : '') +
      (step.unit === 'sec' ? '<span class="badge gray" style="margin-left:5px">按秒计时</span>' : '') +
      (isLast ? '<span class="badge" style="margin-left:5px">最后一式</span>' : '') +
      (completed ? '<span class="badge" style="margin-left:5px;background:#111827;color:#fff">本艺已通关</span>' : '') +
    '</div>' +
    (isLast && !completed ? '<div class="final-tip">这是本艺的最后一式：达成「升级」标准即视为通关，进度条会走满。</div>' : '') +
    '<div class="card"><div class="card-title">动作要点</div>' +
      (step.cue ? '<div class="muted">' + esc(step.cue) + '</div>'
                : '<div class="light">这一式的技术要点待补（当前只有俯卧撑十式写全）</div>') +
      (step.note ? '<div class="danger" style="font-size:11px;margin-top:6px">⚠ ' + esc(step.note) + '</div>' : '') +
    '</div>' +
    '<div class="card"><div class="card-title">三档标准</div>' + tiers +
      '<div class="light" style="font-size:11px;margin-top:6px">' +
        (isLast ? '达成「升级」标准即通关本艺' : '达到「升级」标准后，再进入下一式') + '</div></div>' +
    '<div class="card"><div class="card-title">记录这一式</div>' +
      '<div class="input-row">' +
        '<input class="num-input" id="inp" type="number" inputmode="numeric" placeholder="这次做了多少' + PROG_MOD.unitLabel(step.unit) + '" value="">' +
        '<div class="add-btn" onclick="addSet()">记一组</div>' +
      '</div>' +
      '<div style="margin-top:8px">' + (values.length ? setChips : '<span class="light" style="font-size:11px">点"记一组"逐组记录；点标签可删除</span>') + '</div>' +
      verdict +
      '<div class="btn primary" onclick="finish()">完成本次训练</div>' +
    '</div>' +
    '<div class="nav-row">' +
      '<div class="btn ghost" ' + (no > 1 ? '' : 'disabled') + ' onclick="go(\\'step\\',\\'' + artId + '\\',' + (no - 1) + ')">← 上一式</div>' +
      (no < art.steps.length
        ? '<div class="btn ghost" onclick="go(\\'step\\',\\'' + artId + '\\',' + (no + 1) + ')">下一式 →</div>'
        : '<div class="btn ghost" disabled>已是最后一式</div>') +
    '</div>' +
    '<div class="disclaimer">训练前请热身；动作中出现疼痛请立即停止。本工具不提供医疗建议。</div>';

  var inp = document.getElementById('inp');
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') addSet(); });
}

/* ========== 4. 交互 ========== */
function go(s, a, n) {
  screen = s;
  if (a) artId = a;
  if (n) no = Number(n);
  if (s === 'step') values = [];
  location.hash = s === 'index' ? '#/' : (s === 'art' ? '#/art/' + artId : '#/step/' + artId + '/' + no);
  paint();
}
function paint() {
  ['index', 'art', 'step'].forEach(function (s) {
    document.getElementById('s-' + s).classList.toggle('active', s === screen);
  });
  document.getElementById('back').style.visibility = screen === 'index' ? 'hidden' : 'visible';
  var art = ARTS_MOD.getArt(artId);
  document.getElementById('navTitle').textContent =
    screen === 'index' ? '六艺十式' : (screen === 'art' ? art.name : art.name + ' · 第 ' + no + ' 式');
  if (screen === 'index') renderIndex();
  if (screen === 'art') renderArt();
  if (screen === 'step') renderStep();
}
function addSet() {
  var el = document.getElementById('inp');
  var v = Number(el && el.value);
  var step = ARTS_MOD.getStep(artId, no);
  if (!v || v <= 0) { alert('先填入' + PROG_MOD.unitLabel(step.unit) + '数'); return; }
  values.push(v);
  renderStep();
}
function removeSet(i) { values.splice(i, 1); renderStep(); }
function clearSets() { values = []; renderStep(); }

function finish() {
  var art = ARTS_MOD.getArt(artId);
  var step = ARTS_MOD.getStep(artId, no);
  if (!values.length) { alert('先记至少一组'); return; }
  var result = PROG_MOD.evaluate(step, values);
  store.sessions = store.sessions || [];
  store.sessions.push({ artId: artId, stepId: step.id, no: step.no, values: values.slice(), tier: result.tier, ts: Date.now() });
  store.arts[artId] = Object.assign({}, store.arts[artId], { lastTs: Date.now(), lastStepId: step.id, currentNo: step.no });
  if (result.canAdvance) {
    setPassed(step.id);
    if (allPassed(art)) completeArt(artId);
  }
  saveState(store);

  if (!result.canAdvance) {
    flash('已记录');
    values = [];
    renderStep();
    return;
  }

  // 第十式达标 → 本艺通关（不再"进入下一式"）
  if (step.no >= art.steps.length) {
    completeArt(artId);
    values = [];
    renderStep();
    pendingAdvance = null;
    document.getElementById('dt').textContent = '全部完成';
    document.getElementById('dc').textContent = '「' + art.name + '」十式已全部达标，可以换下一艺了。';
    document.getElementById('dCancel').textContent = '再练一次';
    document.getElementById('dOk').textContent = '看进度';
    document.getElementById('mask').classList.add('show');
    pendingAdvance = -1; // 标记为"通关"分支
    return;
  }

  pendingAdvance = step.no + 1;
  document.getElementById('dt').textContent = '达标了';
  document.getElementById('dc').textContent = '已达成【升级】标准，进入第 ' + (step.no + 1) + ' 式？';
  document.getElementById('dCancel').textContent = '留在本式';
  document.getElementById('dOk').textContent = '进入下一式';
  document.getElementById('mask').classList.add('show');
}
function closeDialog() {
  document.getElementById('mask').classList.remove('show');
  var wasComplete = pendingAdvance === -1;
  pendingAdvance = null;
  if (wasComplete) { pendingAdvance = null; }
  flash('已记录');
}
function confirmDialog() {
  document.getElementById('mask').classList.remove('show');
  if (pendingAdvance === -1) {          // 通关分支 → 回十式列表看进度
    pendingAdvance = null;
    go('art', artId);
    return;
  }
  if (pendingAdvance) {
    store.arts[artId] = Object.assign({}, store.arts[artId], { currentNo: pendingAdvance });
    saveState(store);
    var target = pendingAdvance;
    pendingAdvance = null;
    go('step', artId, target);
  }
}
function resetArt() {
  store.arts[artId] = Object.assign({}, store.arts[artId], { currentNo: 1, completed: false, completedAt: null });
  saveState(store);
  paint();
}
function resetAll() {
  store = { arts: {}, sessions: [] };
  saveState(store);
  values = [];
  go('index');
}
function flash(msg) {
  var d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(17,24,39,.88);color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;z-index:30';
  document.querySelector('.phone').appendChild(d);
  setTimeout(function () { d.remove(); }, 1200);
}

/* ========== 5. 路由（支持 #/art/pushup、#/step/pushup/5 深链） ========== */
function route() {
  var h = location.hash || '#/';
  var m = h.match(/^#\\/step\\/([a-z]+)\\/(\\d+)(?:\\?sets=([\\d,]+))?/);
  if (m && ARTS_MOD.getArt(m[1])) {
    screen = 'step'; artId = m[1]; no = Number(m[2]);
    values = m[3] ? m[3].split(',').map(Number).filter(function (n) { return n > 0; }) : [];
    paint(); return;
  }
  m = h.match(/^#\\/art\\/([a-z]+)(?:\\?(.*))?/);
  if (m && ARTS_MOD.getArt(m[1])) {
    screen = 'art'; artId = m[1];
    var q = m[2] || '';                       // 调试用：?at=3 伪造进度，?done=1 伪造通关
    var at = q.match(/at=(\\d+)/);
    if (at) {
      store.arts[artId] = Object.assign({}, store.arts[artId], { currentNo: Number(at[1]), completed: false });
      saveState(store);
    }
    if (/done=1/.test(q)) completeArt(artId);
    paint(); return;
  }
  // 首页也支持调试参数：?complete=pushup,squat 伪造"这些艺已通关"
  var q = (h.split('?')[1] || '');
  var cp = q.match(/complete=([a-z,]+)/);
  if (cp) {
    cp[1].split(',').forEach(function (id) { if (ARTS_MOD.getArt(id)) completeArt(id); });
  }
  screen = 'index'; paint();
}
window.addEventListener('hashchange', route);
route();
</script>
</body>
</html>
`;

const outDir = path.join(root, 'preview');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), HTML, 'utf8');
console.log(`预览已生成：preview/index.html  (${(HTML.length / 1024).toFixed(1)} KB)`);
