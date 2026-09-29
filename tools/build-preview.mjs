/**
 * 生成网页版预览（手机尺寸、可点击交互）
 *
 * 关键点：预览不复制逻辑，而是把小程序真实的
 *   miniprogram/data/arts.js  和  miniprogram/utils/progress.js
 * 源码注入页面里执行 —— 预览里看到的行为 = 小程序里的行为。
 *
 * 进度模型（与小程序一致）：锁定式推进
 *   唯一的进度真相 = steps[stepId].passedAt（"已通过"表）
 *   当前式 = 第一个还没通过的式（由 progress.js 的 currentNo 推导，不存储）
 *   arts[artId].currentNo 这个老字段已经删掉：预览里既不读也不写
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
  .card-title { font-size: 13px; color: #64748b; margin-bottom: 6px; }
  .badge { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #eff6ff; color: #2563eb; }
  .badge.gray { background: #f1f5f9; color: #475569; }
  .accent { color: #2563eb; } .muted { color: #64748b; } .light { color: #64748b; } .danger { color: #dc2626; }
  .hr { height: 1px; background: #e2e8f0; margin: 12px 0; }
  .row-between { display: flex; align-items: flex-start; justify-content: space-between; }
  .btn { margin-top: 12px; background: #111827; color: #fff; border-radius: 8px; font-size: 15px; line-height: 44px; text-align: center; cursor: pointer; }
  .btn.primary { background: #2563eb; }
  .btn.ghost { background: #fff; color: #111827; border: 1px solid #cbd5e1; }
  .btn[disabled] { opacity: .45; cursor: default; }
  .chip { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 999px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155; margin: 4px 6px 0 0; cursor: pointer; }
  .chip.on { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
  .disclaimer { margin-top: 20px; font-size: 11px; color: #64748b; line-height: 1.7; }

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

  /* 首页：有已记录但未提交的组 */
  .pending-tip { margin-top: 12px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px; color: #1d4ed8; line-height: 1.6; cursor: pointer; }
  .pending-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }

  .tagline { margin-top: 8px; padding: 8px 10px; background: #eff6ff; color: #1d4ed8; border-radius: 6px; font-size: 12px; }
  .progress-card { margin-top: 12px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
  .progress-card.is-done { background: #f0fdf4; border-color: #86efac; }
  .progress-label { font-size: 15px; font-weight: 700; }
  .progress-card .bar { height: 8px; margin-top: 9px; }
  .done-tag { color: #15803d; }

  /* ---- 十式列表：只有三态 passed / current / locked ---- */
  .step-item { display: flex; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #e2e8f0; border-radius: 9px; padding: 11px; margin-top: 8px; cursor: pointer; }
  .step-item.passed { border-left-color: #16a34a; background: #fbfefc; }
  .step-item.current { border-left-color: #2563eb; border-color: #bfdbfe; background: #f8fbff; }
  .step-item.locked { border-left-color: #e2e8f0; background: #fcfcfd; }
  .step-no { width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700; flex: none; }
  .step-item.passed .step-no { background: #16a34a; color: #fff; }
  .step-item.current .step-no { background: #2563eb; color: #fff; }
  .step-item.locked .step-no { background: #f1f5f9; color: #475569; font-size: 11px; }
  .step-body { flex: 1; margin-left: 10px; min-width: 0; }
  .step-name { font-size: 15px; font-weight: 700; }
  .step-item.locked .step-name { color: #64748b; }
  .step-state { flex: none; margin-left: 6px; font-size: 11px; padding: 2px 7px; border-radius: 999px; white-space: nowrap; text-align: center; display: flex; flex-direction: column; }
  .step-state .state-sub { font-size: 9px; opacity: .75; margin-top: 1px; }
  .step-state.passed { color: #15803d; background: #dcfce7; }
  .step-state.current { color: #1d4ed8; background: #dbeafe; font-weight: 700; }
  .step-state.locked { color: #475569; background: #f1f5f9; }
  .list-legend { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 12px; font-size:  11px; color: #64748b; }
  .list-legend .lg.passed { color: #15803d; }
  .list-legend .lg.current { color: #1d4ed8; }
  .list-legend .lg.locked { color: #64748b; }

  .final-tip { margin-top: 8px; padding: 9px 11px; background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; border-radius: 7px; font-size: 12px; line-height: 1.6; }
  .art-card.is-done { border-color: #86efac; background: #f7fef9; }
  .art-card.is-done .bar-in { background: #16a34a; }
  .done-text { font-size: 11px; font-weight: 700; color: #15803d; }
  .card.all-done { background: #f0fdf4; border-color: #86efac; }
  .all-done-title { font-size: 17px; font-weight: 700; color: #15803d; }

  /* ---- 详情页：状态横幅 + 按标准一键记录 + 未解锁 ---- */
  .banner { padding: 10px 12px; border-radius: 8px; margin-bottom: 8px; }
  .banner-title { font-size: 14px; font-weight: 700; }
  .banner-sub { font-size: 11px; margin-top: 2px; opacity: .85; line-height: 1.5; }
  .banner.passed { background: #f0fdf4; border: 1px solid #86efac; color: #15803d; }
  .banner.current { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
  .banner.locked { background: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; }

  .quick-label { font-size: 12px; color: #334155; margin-bottom: 5px; }
  .quick-row { display: flex; }
  .quick-btn { min-height: 44px; flex: 1; display: flex; flex-direction: column; align-items: center; padding: 8px 0; background: #fff; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 11px; color: #111827; text-align: center; cursor: pointer; }
  .quick-btn + .quick-btn { margin-left: 7px; }
  .quick-btn.on { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 700; }

  .locked-box { padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; }
  .locked-title { font-size: 14px; font-weight: 700; color: #475569; }
  .locked-sub { font-size: 12px; color: #64748b; margin-top: 5px; line-height: 1.6; }
  .locked-note { font-size: 11px; color: #64748b; margin-top: 5px; }

  .restored-tip { margin-bottom: 8px; padding: 8px 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 6px; font-size: 12px; }
  .last-result { margin-bottom: 10px; padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 7px; }
  .last-title { font-size: 12px; font-weight: 700; color: #15803d; margin-bottom: 3px; }

  .hist-row { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .hist-row:last-child { border-bottom: none; }
  .hist-time { width: 95px; color: #64748b; font-size: 11px; }
  .hist-sets { flex: 1; color: #334155; }
  .hist-tier { color: #2563eb; font-size: 11px; }
  .hist-toggle { margin-top: 8px; text-align: center; font-size: 11px; line-height: 44px; color: #2563eb; cursor: pointer; }

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
  .dialog .dc { padding: 0 18px 18px; font-size: 13px; color: #475569; line-height: 1.7; white-space: pre-line; }
  .dialog .da { display: flex; border-top: 1px solid #eef2f7; }
  .dialog .da div { flex: 1; padding: 12px; font-size: 15px; cursor: pointer; }
  .dialog .da div + div { border-left: 1px solid #eef2f7; color: #2563eb; font-weight: 600; }
</style>
</head>
<body>

<div class="head">
  <h1>六艺十式 · 网页预览</h1>
  <p>手机尺寸交互预览 v0.1 ｜ 点卡片进十式，点式进详情，可以真的记录并判定晋级（锁定式推进）</p>
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
        <div onclick="confirmDialog()" id="dOk">去练下一式</div>
      </div>
    </div>
  </div>
</div>

<div class="note">
  预览用的是小程序里<b>同一套</b> data/arts.js 与 utils/progress.js（源码注入执行），
  不是另写一遍 —— 所以判定结果与真机一致。<br>
  进度只认"已通过"表：当前式 = 第一个还没通过的式，达标即自动解锁下一式。<br>
  地址栏支持深链，例如 <code>#/step/pushup/5</code>、<code>#/art/pushup?at=4</code>。
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

/* ========== 2. 预览用的"本地存储"（等价于 utils/store.js） ==========
 * 唯一进度真相：store.steps[stepId] = { passedAt }   ——"已通过"表
 * 当前式不存储：currentNo 由 progress.js 从 passed 表推导出来
 * 老字段 arts[artId].currentNo 已废弃：这里既不读也不写（加载时顺手清掉残留）
 */
var KEY = 'cf_preview_state_v1';

function normalizeState(s) {
  var src = (s && typeof s === 'object') ? s : {};
  var out = {
    version: 2,
    arts: (src.arts && typeof src.arts === 'object') ? src.arts : {},
    sessions: Array.isArray(src.sessions) ? src.sessions : [],
    drafts: (src.drafts && typeof src.drafts === 'object') ? src.drafts : {},
    steps: (src.steps && typeof src.steps === 'object') ? src.steps : {}
  };
  Object.keys(out.arts).forEach(function (k) { if (out.arts[k]) delete out.arts[k].currentNo; });
  return out;
}
function emptyState() { return normalizeState({}); }
function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(KEY))); }
  catch (e) { return emptyState(); }
}
function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
var store = loadState();

/* ---- 已通过表 ---- */
function passedMap() { return store.steps || (store.steps = {}); }
function isPassed(stepId) { return !!passedMap()[stepId]; }
function setStepPassed(stepId, value) {
  store.steps = store.steps || {};
  if (value === false) delete store.steps[stepId];
  else if (!store.steps[stepId]) store.steps[stepId] = { passedAt: Date.now() };
  saveState(store);
}
function passedCountOf(art) {
  return art.steps.filter(function (s) { return isPassed(s.id); }).length;
}
function allPassed(art) {
  return art.steps.every(function (s) { return isPassed(s.id); });
}

/* ---- 通关里程碑 ---- */
function isCompleted(artId) { return !!(store.arts[artId] && store.arts[artId].completed); }
function completeArt(artId) {
  var prev = store.arts[artId] || {};
  store.arts[artId] = Object.assign({}, prev, {
    completed: true,
    completedAt: prev.completedAt || Date.now(),
    lastCompletedAt: Date.now()
  });
  delete store.arts[artId].currentNo;   // 老字段，一并清掉
  saveState(store);
}

/**
 * 当前式 = 第一个还没通过的式（推导，不存储）
 * 直接复用 progress.js 的同一个纯函数，保证与小程序逐字一致。
 * @returns {number|null} 十式全部通过（或已通关）→ null
 */
function currentNo(art) {
  return PROG_MOD.currentNo(art, { passed: passedMap(), completed: isCompleted(art.id) });
}

/* ---- 未提交的组（草稿）：每组立刻落盘 ---- */
function getDraft(stepId) {
  var d = (store.drafts || {})[stepId];
  return d && Array.isArray(d.values) ? d : null;
}
function draftValues(stepId) {
  var d = getDraft(stepId);
  return d ? d.values.slice() : [];
}
function saveDraft(stepId, values) {
  store.drafts = store.drafts || {};
  if (!values || !values.length) delete store.drafts[stepId];
  else store.drafts[stepId] = { values: values.slice(), ts: Date.now() };
  saveState(store);
  return store.drafts[stepId] || null;
}
function clearDraft(stepId) {
  if (store.drafts && store.drafts[stepId]) { delete store.drafts[stepId]; saveState(store); }
}
function pendingList() {
  var drafts = store.drafts || {};
  return Object.keys(drafts).map(function (k) {
    return { stepId: k, values: (drafts[k] && drafts[k].values) || [], ts: (drafts[k] && drafts[k].ts) || 0 };
  });
}
function pendingSets() {
  return pendingList().reduce(function (n, d) { return n + d.values.length; }, 0);
}

/* ---- 训练记录 ---- */
function sessionsOf(artId) {
  return (store.sessions || []).filter(function (x) { return !artId || x.artId === artId; });
}
function addSession(session) {
  store.sessions = store.sessions || [];
  var rec = Object.assign({ ts: Date.now() }, session);
  store.sessions.push(rec);
  if (store.sessions.length > 500) store.sessions = store.sessions.slice(-500);
  store.arts[session.artId] = Object.assign({}, store.arts[session.artId], {
    lastTs: rec.ts,
    lastStepId: session.stepId
  });
  delete store.arts[session.artId].currentNo;
  saveState(store);
  return rec;
}

/**
 * 重置某个艺：清"已通过"表 + 通关标记 + **本艺未提交的草稿**（对齐 store.resetArt）
 * 训练记录（sessions）保留 —— 那是历史。
 */
function resetArtProgress(artId, stepIds) {
  var prev = store.arts[artId] || {};
  var next = Object.assign({}, prev, { completed: false, completedAt: null, lastCompletedAt: null });
  delete next.currentNo;
  store.arts[artId] = next;
  (stepIds || []).forEach(function (id) {
    if (store.steps) delete store.steps[id];
    if (store.drafts) delete store.drafts[id];
  });
  saveState(store);
}

/** 调试/深链用：把某个艺十式全部记为已通过 + 通关 */
function debugPassArt(artId) {
  var art = ARTS_MOD.getArt(artId);
  if (!art) return;
  art.steps.forEach(function (s) { setStepPassed(s.id, true); });
  completeArt(artId);
}

/* ========== 3. 渲染 ========== */
var screen = 'index', artId = 'pushup', no = 1;
var restored = false;       // 进入详情页时是否恢复了未提交的组
var lastSummary = null;     // 上一次提交后的持久反馈（对齐 step.js 的 lastSummary）
var historyExpanded = false;
var dialogAction = null;    // 弹窗两个按钮各自要做什么（对齐 wx.showModal 的 success/confirm）

function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

/** 只有"当前式"和"已通过的式"能记录；再往后只能看 */
function isLockedStep(art, step) {
  return !PROG_MOD.canPractice(art, step, { passed: passedMap(), completed: isCompleted(art.id) });
}

function renderIndex() {
  var sessions = store.sessions || [];

  // 推荐逻辑与小程序共用同一个纯函数：跳过已通关的艺，当前式由 passed 表推导
  var curOf = {};
  ARTS_MOD.ARTS.forEach(function (a) { curOf[a.id] = currentNo(a); });
  var rec = PROG_MOD.recommend(ARTS_MOD.ARTS, {
    sessions: sessions,
    currentNoOf: function (id) { return curOf[id]; },
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

  var pending = pendingList();
  var pendingTip = pending.length
    ? '<div class="pending-tip" onclick="goPending()">' +
        '<div class="pending-title">有 ' + pendingSets() + ' 组已记录，还没提交</div>' +
        '<div>点这里继续（或到该动作点"完成本次训练"提交）</div>' +
      '</div>'
    : '';

  var cards = ARTS_MOD.ARTS.map(function (a) {
    var completed = isCompleted(a.id);
    var st = PROG_MOD.artStatus(a, { passed: passedMap(), completed: completed });
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
        '<span class="light" style="font-size:10px">通过 ' + st.passed + '/10 · 图 ' + drawn + '/10</span>' +
      '</div></div>';
  }).join('');

  document.getElementById('s-index').innerHTML =
    '<div class="h1">六艺十式</div>' +
    '<div class="sub">六个动作 · 每个十式 · 达到标准才进下一式</div>' +
    pendingTip +
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

  // 进度真相只有一个：每一式的"已通过"表。当前式 = 第一个未通过的式（推导）
  var passed = passedMap();
  var completed = isCompleted(art.id);
  var sessions = sessionsOf(art.id);
  var drafts = pendingList();

  var states = PROG_MOD.stepStates(art, { passed: passed, completed: completed, sessions: sessions, drafts: drafts });
  var st = PROG_MOD.artStatus(art, { passed: passed, completed: completed });
  var passedCount = passedCountOf(art);
  var practicedCount = states.filter(function (x) { return x.times > 0; }).length;

  var rows = art.steps.map(function (s, idx) {
    var x = states[idx];
    return '<div class="step-item ' + x.state + '" onclick="go(\\'step\\',\\'' + art.id + '\\',' + s.no + ')">' +
      '<div class="step-no">' + (x.state === 'passed' ? '✓' : (x.isLocked ? '🔒' : s.no)) + '</div>' +
      '<div class="step-body">' +
        '<div class="step-name">' + esc(s.name) +
          (s.perSide ? ' <span class="badge gray" style="margin-left:5px">每侧</span>' : '') +
          (s.unit === 'sec' ? ' <span class="badge gray" style="margin-left:5px">按秒</span>' : '') + '</div>' +
        '<div class="muted" style="font-size:11px;margin-top:3px">' + esc(PROG_MOD.formatStdLine(s)) + '</div>' +
        (s.art ? '' : '<div class="light" style="font-size:10px;margin-top:2px">示意图待补</div>') +
        (s.note ? '<div class="danger" style="font-size:10px;margin-top:2px">数据待校对：' + esc(s.note) + '</div>' : '') +
      '</div>' +
      '<div class="step-state ' + x.state + '">' +
        '<span>' + esc(x.stateText) + '</span>' +
        (x.stateSub ? '<span class="state-sub">' + esc(x.stateSub) + '</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  document.getElementById('s-art').innerHTML =
    '<div class="h1">' + esc(art.name) + '</div>' +
    '<div class="sub">' + esc(art.en) + ' · 主练 ' + esc(art.focus) + '</div>' +
    '<div class="tagline">' + esc(art.tagline) + '</div>' +
    '<div class="progress-card' + (completed ? ' is-done' : '') + '">' +
      '<div class="row-between">' +
        '<div class="progress-label">' + (completed ? '<span class="done-tag">已通关</span>' : esc(st.label)) + '</div>' +
        '<div class="muted" style="font-size:12px">已通过 ' + st.done + ' / ' + st.total + ' 式</div>' +
      '</div>' +
      '<div class="bar"><div class="bar-in" style="width:' + st.percent + '%"></div></div>' +
      '<div class="row-between" style="margin-top:8px">' +
        '<span class="light" style="font-size:11px">已通过 ' + passedCount + ' 式 · 练过 ' + practicedCount + ' 式 · 共 ' + sessions.length + ' 次训练</span>' +
        '<span class="chip" onclick="askResetArt()">重置</span>' +
      '</div>' +
    '</div>' +
    '<div class="list-legend">' +
      '<span class="lg passed">✓ 已通过（可复习）</span>' +
      '<span class="lg current">进行中 = 当前这一式</span>' +
      '<span class="lg locked">🔒 未解锁 = 先通过前面那式</span>' +
    '</div>' + rows +
    '<div class="disclaimer">标准整理自公开中文资料，各版本记载略有差异，仅供参考。</div>';
}

function renderStep() {
  var art = ARTS_MOD.getArt(artId);
  var step = ARTS_MOD.getStep(artId, no);

  var passed = passedMap();
  var completed = isCompleted(art.id);
  var curNo = currentNo(art);
  var isPassed = !!passed[step.id];
  var isCurrent = !completed && curNo === step.no;
  // 锁定式推进：只有"已通过的式"和"当前式"能记录，再往后只能看
  var locked = isLockedStep(art, step);
  var curStep = curNo ? ARTS_MOD.getStep(artId, curNo) : null;
  var lockHint = locked && curStep
    ? '先通过第 ' + curNo + ' 式（' + curStep.name + '）—— ' + PROG_MOD.gapText(PROG_MOD.evaluate(curStep, []))
    : '';

  var values = draftValues(step.id);
  var result = PROG_MOD.evaluate(step, values);
  var tiers = PROG_MOD.tiersOf(step).map(function (t, i) {
    return Object.assign({}, t, {
      text: PROG_MOD.formatTier(t),
      done: i <= result.tierIndex,          // 该档（及更低档）是否已达成
      reached: i === result.tierIndex       // 当前正好落在这一档
    });
  });

  var unitLabel = PROG_MOD.unitLabel(step.unit);
  var tierRows = tiers.map(function (t) {
    return '<div class="tier-row ' + (t.reached ? 'hit' : '') + '">' +
      '<span class="tier-name">' + t.tier + '</span>' +
      '<span class="tier-val">' + esc(t.text) + '</span>' +
      '<span class="tier-flag">' + (t.done ? '已达成' : '') + '</span></div>';
  }).join('');

  // 已提交的记录（持久化在本地，重进页面必须能看到）
  var historyAll = sessionsOf(art.id)
    .filter(function (s) { return s.no === step.no; })
    .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  var history = historyExpanded ? historyAll : historyAll.slice(0, 3);
  var historyMore = Math.max(historyAll.length - history.length, 0);

  var banner = PROG_MOD.stepBanner(art, step, {
    isPassed: isPassed,
    isCurrent: isCurrent,
    completed: completed,
    times: historyAll.length,
    lastTier: historyAll.length ? (historyAll[0].tier || '未达档') : null,
    unlockHint: lockHint
  });

  var viewText = step.view === 'top' ? '俯视（从上往下看）' : (step.view === 'front' ? '正视' : '侧视');
  var isLast = step.no === art.steps.length;
  var pose = step.art
    ? '<img class="pose" src="../miniprogram/assets/movements/' + step.art + '.png" alt="">'
    : '<div class="pose-empty"><div class="light">示意图待补</div><div class="light" style="font-size:10px;margin-top:4px">已有名称与标准，图后续补齐</div></div>';

  var setChips = values.map(function (v, i) {
    return '<span class="chip on" onclick="removeSet(' + i + ')">第 ' + (i + 1) + ' 组 ' + v + unitLabel + ' ×</span>';
  }).join('') + (values.length ? '<span class="chip" onclick="clearSets()">清空</span>' : '');

  var verdict = values.length
    ? '<div class="verdict"><div class="accent">' + esc(PROG_MOD.tierText(result)) + '</div>' +
      '<div class="muted" style="margin-top:3px">' + esc(PROG_MOD.gapText(result)) + '</div></div>'
    : '';

  var lastResultCard = lastSummary
    ? '<div class="last-result">' +
        '<div class="last-title">上一次记录已保存</div>' +
        '<div class="muted" style="font-size:12px">' + lastSummary.count + ' 组（' + esc(lastSummary.setsText) + '）' + lastSummary.unitLabel + '｜' + esc(lastSummary.tierText) + '</div>' +
        '<div class="accent" style="font-size:12px;margin-top:3px">' + esc(lastSummary.gapText) + '</div>' +
        '<div class="light" style="font-size:10px;margin-top:3px">' + esc(lastSummary.savedLine) + '</div>' +
      '</div>'
    : '';

  // 未解锁：能看动作图和标准，但没有输入区、没有"完成本次训练"，只给一个"去练第 N 式"
  var recordCard = locked
    ? '<div class="locked-box">' +
        '<div class="locked-title">🔒 这一式还没解锁</div>' +
        '<div class="locked-sub">' + esc(lockHint) + '</div>' +
        '<div class="locked-note">动作图和标准都可以看；练到达标才能解锁它。</div>' +
        '<div class="btn primary" onclick="goCurrent()">去练第 ' + (curNo === null ? art.steps.length : curNo) + ' 式</div>' +
      '</div>'
    : (restored && values.length
        ? '<div class="restored-tip">已恢复上次未提交的 ' + values.length + ' 组记录，可以接着记</div>'
        : '') +
      lastResultCard +
      '<div class="quick-label">按标准一键记录</div>' +
      '<div class="quick-row">' +
        tiers.map(function (t, i) {
          return '<div class="quick-btn ' + (t.done ? 'on' : '') + '" onclick="applyTier(' + i + ')">' +
            esc(t.tier + ' ' + t.sets + '×' + t.value + unitLabel) + '</div>';
        }).join('') +
      '</div>' +
      '<div class="light" style="font-size:10px;margin-top:4px">点一下即按该档标准填入（会覆盖当前未提交的组）；也可以自己逐组输</div>' +
      '<div class="input-row" style="margin-top:8px">' +
        '<input class="num-input" id="inp" type="number" inputmode="numeric" placeholder="这次做了多少' + unitLabel + '" value="">' +
        '<div class="add-btn" onclick="addSet()">记一组</div>' +
      '</div>' +
      '<div style="margin-top:8px">' + (values.length ? setChips : '<span class="light" style="font-size:11px">每组都会立即保存，离开页面也不会丢</span>') + '</div>' +
      verdict +
      '<div class="btn primary" onclick="finish()">完成本次训练</div>';

  var historyCard = historyAll.length
    ? '<div class="card"><div class="card-title">这一式的记录（' + historyAll.length + ' 次）</div>' +
        history.map(function (h) {
          return '<div class="hist-row">' +
            '<span class="hist-time">' + esc(PROG_MOD.formatTime(h.ts)) + '</span>' +
            '<span class="hist-sets">' + (h.values || []).length + ' 组（' + (h.values || []).join(' / ') + '）' + unitLabel + '</span>' +
            '<span class="hist-tier">' + esc(h.tier || '未达档') + '</span>' +
          '</div>';
        }).join('') +
        (historyMore > 0
          ? '<div class="hist-toggle" onclick="toggleHistory()">展开剩余 ' + historyMore + ' 条 ↓</div>'
          : (historyExpanded && historyAll.length > 3 ? '<div class="hist-toggle" onclick="toggleHistory()">收起 ↑</div>' : '')) +
      '</div>'
    : '<div class="card"><div class="card-title">这一式的记录</div>' +
        '<div class="light">还没有提交过记录。记完组后点「完成本次训练」就会出现在这里。</div></div>';

  document.getElementById('s-step').innerHTML =
    '<div class="banner ' + banner.kind + '">' +
      '<div class="banner-title">' + esc(banner.title) + '</div>' +
      '<div class="banner-sub">' + esc(banner.sub) + '</div>' +
    '</div>' +
    '<div class="pose-box">' + pose + '<div class="view-tag">' + viewText + '</div></div>' +
    '<div class="h1" style="margin-top:12px">' + esc(step.name) + '</div>' +
    '<div class="sub">' + esc(art.name) + ' · 第 ' + step.no + ' / ' + art.steps.length + ' 式 · ' + esc(step.en) + '</div>' +
    '<div style="margin-top:6px">' +
      (step.perSide ? '<span class="badge">每侧计数</span>' : '') +
      (step.unit === 'sec' ? '<span class="badge gray" style="margin-left:5px">按秒计时</span>' : '') +
      (isLast ? '<span class="badge" style="margin-left:5px">最后一式</span>' : '') +
      (completed ? '<span class="badge" style="margin-left:5px;background:#111827;color:#fff">本艺已通关</span>' : '') +
    '</div>' +
    (isLast && !completed && !isPassed ? '<div class="final-tip">这是本艺的最后一式：达成「升级」标准即视为通关，进度条会走满。</div>' : '') +
    '<div class="card"><div class="card-title">动作要点</div>' +
      (step.cue ? '<div class="muted">' + esc(step.cue) + '</div>'
                : '<div class="light">这一式的技术要点待补（当前只有俯卧撑十式写全）</div>') +
      (step.note ? '<div class="danger" style="font-size:11px;margin-top:6px">⚠ ' + esc(step.note) + '</div>' : '') +
    '</div>' +
    '<div class="card"><div class="card-title">三档标准</div>' + tierRows +
      '<div class="light" style="font-size:11px;margin-top:6px">' +
        (isLast ? '达成「升级」标准即通关本艺' : '达成「升级」标准后，这一式会记为「已通过」') + '</div></div>' +
    '<div class="card"><div class="card-title">记录这一式（每记一组立即保存到本机）</div>' +
      recordCard +
    '</div>' +
    historyCard +
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
  var prevScreen = screen, prevArt = artId, prevNo = no;
  screen = s;
  if (a) artId = a;
  if (n) no = Number(n);
  var changed = (s !== prevScreen) || (artId !== prevArt) || (no !== prevNo);
  if (s === 'step') {
    // 草稿是持久化的：进来就把这一式未提交的组恢复出来
    var step = ARTS_MOD.getStep(artId, no);
    restored = !!(step && draftValues(step.id).length);
    if (changed) { lastSummary = null; historyExpanded = false; }
  }
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

/* ---- 弹窗（两个按钮各自带动作，对齐 wx.showModal） ---- */
function openDialog(o) {
  document.getElementById('dt').textContent = o.title;
  document.getElementById('dc').textContent = o.content;
  document.getElementById('dCancel').textContent = o.cancelText;
  document.getElementById('dOk').textContent = o.okText;
  dialogAction = { ok: o.onOk || function () {}, cancel: o.onCancel || function () {} };
  document.getElementById('mask').classList.add('show');
}
function closeDialog() {
  var a = dialogAction; dialogAction = null;
  document.getElementById('mask').classList.remove('show');
  if (a) a.cancel();
}
function confirmDialog() {
  var a = dialogAction; dialogAction = null;
  document.getElementById('mask').classList.remove('show');
  if (a) a.ok();
}

/* ---- 记录（只允许当前式 / 已通过的式） ---- */
function requireUnlocked() {
  var art = ARTS_MOD.getArt(artId);
  var step = ARTS_MOD.getStep(artId, no);
  if (isLockedStep(art, step)) {
    var cur = currentNo(art);
    flash('先通过第 ' + (cur === null ? art.steps.length : cur) + ' 式');
    return null;
  }
  return step;
}
function addSet() {
  var step = requireUnlocked();
  if (!step) return;
  var el = document.getElementById('inp');
  var v = Number(el && el.value);
  if (!v || v <= 0) { alert('先填入' + PROG_MOD.unitLabel(step.unit) + '数'); return; }
  saveDraft(step.id, draftValues(step.id).concat([v]));   // 立刻落盘
  restored = false;
  renderStep();
}

/**
 * 按某一档标准一键填入（覆盖当前未提交的组 —— "点中级"就是"我这次做到中级标准"）
 */
function applyTier(i) {
  var step = requireUnlocked();
  if (!step) return;
  var t = PROG_MOD.tiersOf(step)[i];
  if (!t) return;
  var values = [];
  for (var k = 0; k < t.sets; k++) values.push(t.value);
  saveDraft(step.id, values);
  restored = false;
  renderStep();
  flash('已按【' + t.tier + '】填入 ' + t.sets + ' 组');
}
function removeSet(i) {
  var step = ARTS_MOD.getStep(artId, no);
  var values = draftValues(step.id);
  values.splice(i, 1);
  saveDraft(step.id, values);
  restored = false;
  renderStep();
}
function clearSets() {
  var step = ARTS_MOD.getStep(artId, no);
  clearDraft(step.id);
  restored = false;
  renderStep();
}
function toggleHistory() { historyExpanded = !historyExpanded; renderStep(); }

/** 从"未解锁"的页面一键回到当前该练的那一式 */
function goCurrent() {
  var art = ARTS_MOD.getArt(artId);
  var cur = currentNo(art);
  go('step', artId, cur === null ? art.steps.length : cur);
}

function finish() {
  var art = ARTS_MOD.getArt(artId);
  var step = requireUnlocked();
  if (!step) return;
  var values = draftValues(step.id);
  if (!values.length) { alert('先记至少一组'); return; }

  var result = PROG_MOD.evaluate(step, values);
  var rec = addSession({
    artId: art.id,
    stepId: step.id,
    no: step.no,
    values: values.slice(),
    unit: step.unit,
    perSide: step.perSide,
    tierIndex: result.tierIndex,
    tier: result.tier
  });
  clearDraft(step.id);                 // 已转成正式记录
  restored = false;

  var times = sessionsOf(art.id).filter(function (s) { return s.no === step.no; }).length;
  lastSummary = {
    setsText: values.join(' / '),
    count: values.length,
    unitLabel: PROG_MOD.unitLabel(step.unit),
    tierText: PROG_MOD.tierText(result),
    gapText: PROG_MOD.gapText(result),
    savedLine: '已保存到本机（本式共 ' + times + ' 次 · localStorage）',
    at: rec.ts
  };
  renderStep();

  // ① 没达标：记录已保存，当前式不变，继续练这一式
  if (!result.canAdvance) {
    openDialog({
      title: '本次已记录',
      content: values.length + ' 组（' + values.join(' / ') + '）' + lastSummary.unitLabel + '\\n' +
               lastSummary.tierText + '\\n' + lastSummary.gapText + '\\n' + lastSummary.savedLine,
      okText: '再练一组',
      cancelText: '回十式列表',
      onOk: function () { renderStep(); },
      onCancel: function () { go('art', art.id); }
    });
    return;
  }

  // ② 达标：记为「已通过」→ 下一式自动成为进行中（不需要任何"推进当前式"的动作）
  setStepPassed(step.id, true);
  var allPassedNow = allPassed(art);
  if (allPassedNow) completeArt(art.id);

  if (step.no < art.steps.length) {
    openDialog({
      title: allPassedNow ? '全部完成' : '达标了',
      content: allPassedNow
        ? '「' + art.name + '」十式已全部达标，可以换下一艺了。'
        : '已达成【升级】标准，已记为「已通过」。第 ' + (step.no + 1) + ' 式已解锁，现在去练？',
      okText: allPassedNow ? '看进度' : '去练下一式',
      cancelText: allPassedNow ? '再练一次' : '留在本式',
      onOk: function () { if (allPassedNow) go('art', art.id); else go('step', art.id, step.no + 1); },
      onCancel: function () { renderStep(); }
    });
    return;
  }

  // ③ 最后一式达标（注意：只有十式全通过才算通关）
  var passedCount = passedCountOf(art);
  openDialog({
    title: allPassedNow ? '全部完成' : '这一式已通过',
    content: allPassedNow
      ? '「' + art.name + '」十式已全部达标，可以换下一艺了。'
      : '第 ' + step.no + ' 式已记为「已通过」。本艺还有 ' + (art.steps.length - passedCount) + ' 式没通过，可以回列表补齐。',
    okText: allPassedNow ? '看进度' : '回十式列表',
    cancelText: allPassedNow ? '再练一次' : '留在这里',
    onOk: function () { go('art', art.id); },
    onCancel: function () { renderStep(); }
  });
}

/** 重置进度：连同"已通过"表和本艺未提交的草稿一起清（训练记录保留） */
function askResetArt() {
  var art = ARTS_MOD.getArt(artId);
  openDialog({
    title: '重置进度',
    content: '把「' + art.name + '」退回第 1 式、并清掉"已通过"标记和未提交的组？训练记录会保留。',
    okText: '确定',
    cancelText: '取消',
    onOk: function () {
      resetArtProgress(art.id, art.steps.map(function (s) { return s.id; }));
      paint();
    },
    onCancel: function () {}
  });
}
function resetAll() {
  store = emptyState();
  saveState(store);
  restored = false;
  lastSummary = null;
  historyExpanded = false;
  go('index');
}
function goPending() {
  var first = pendingList()[0];
  if (!first) return;
  var m = /^([a-z]+)-(\\d+)$/.exec(first.stepId);
  if (!m) return;
  go('step', m[1], Number(m[2]));
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

  // #/step/pushup/5?sets=25,25,30 —— 预填未提交的组
  var m = h.match(/^#\\/step\\/([a-z]+)\\/(\\d+)(?:\\?sets=([\\d,]+))?/);
  if (m && ARTS_MOD.getArt(m[1])) {
    screen = 'step'; artId = m[1]; no = Number(m[2]);
    var step = ARTS_MOD.getStep(artId, no);
    if (step && m[3]) {
      var pre = m[3].split(',').map(Number).filter(function (n) { return n > 0; });
      if (pre.length) saveDraft(step.id, pre);
    }
    restored = !!(step && draftValues(step.id).length);
    lastSummary = null;
    historyExpanded = false;
    paint(); return;
  }

  m = h.match(/^#\\/art\\/([a-z]+)(?:\\?(.*))?/);
  if (m && ARTS_MOD.getArt(m[1])) {
    screen = 'art'; artId = m[1];
    var q = m[2] || '';
    // 调试用：?at=4 伪造"练到第 4 式" —— 把 1..3 式记为已通过（当前式由 passed 表推导出来）
    // 等价于小程序里的 store.debugUnlockTo（后面的式一起清掉，保证列表三态可预期）
    var at = q.match(/at=(\\d+)/);
    if (at) {
      var art = ARTS_MOD.getArt(artId);
      var unlockTo = Number(at[1]);
      art.steps.forEach(function (s, i) {
        if (i < unlockTo - 1) {
          setStepPassed(s.id, true);           // 1..N-1 记为已通过 → 当前式推导为 N
        } else {
          setStepPassed(s.id, false);
          clearDraft(s.id);                    // 被锁回去的式不可能有"未提交的组"，一并清掉
        }
      });
      var prev = store.arts[artId] || {};
      store.arts[artId] = Object.assign({}, prev, { completed: false, completedAt: null, lastCompletedAt: null });
      delete store.arts[artId].currentNo;
      saveState(store);
    }
    // ?done=1 伪造"已通关"：十式全部记为已通过 + completed
    if (/done=1/.test(q)) debugPassArt(artId);
    paint(); return;
  }

  // 首页也支持调试参数：?complete=pushup,squat 伪造"这些艺已通关"
  var q2 = (h.split('?')[1] || '');
  var cp = q2.match(/complete=([a-z,]+)/);
  if (cp) {
    cp[1].split(',').forEach(function (id) { if (ARTS_MOD.getArt(id)) debugPassArt(id); });
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
