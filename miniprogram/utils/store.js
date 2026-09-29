/**
 * 本地状态存储（进度 + 训练记录）
 * 用 wx.setStorageSync；在没有 wx 的环境（Node 单测）自动退化为内存存储，方便测试。
 */

const KEY = 'cf_state_v1';
const mem = {};
let lastError = null;   // 最近一次存储异常（不再静默吞掉）

/** 每次都现查 wx（不在模块加载时缓存）——避免"模块先于 wx 注入执行"导致的静默降级 */
function wxCtx() {
  return (typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function') ? wx : null;
}

function rawGet() {
  const w = wxCtx();
  if (w) {
    try { return w.getStorageSync(KEY) || null; } catch (e) { lastError = '读失败：' + ((e && e.message) || e); return null; }
  }
  return mem[KEY] || null;
}

/**
 * 写 + 立刻读回校验。
 * 之前这里是 try/catch 静默吞异常，导致"存不进去"在界面上完全看不出来。
 */
function rawSet(v) {
  const w = wxCtx();
  if (!w) { mem[KEY] = v; lastError = '未拿到 wx，已降级到内存'; return; }
  try {
    w.setStorageSync(KEY, v);
    const back = w.getStorageSync(KEY);
    const want = (v && v.sessions) ? v.sessions.length : 0;
    const got = (back && back.sessions) ? back.sessions.length : -1;
    lastError = (got === want) ? null : `写入后读回不一致（写 ${want} 条，读回 ${got} 条）`;
  } catch (e) {
    lastError = '写失败：' + ((e && e.message) || e);
  }
}

/* ---------------- 进行中的训练（草稿）：每组立刻落盘 ---------------- */

/** 读某一式的进行中记录 */
function getDraft(stepId) {
  const d = getState().drafts[stepId];
  return d && Array.isArray(d.values) ? d : null;
}

/** 写入/更新某一式的进行中记录（values 为空则清除） */
function saveDraft(stepId, values) {
  const s = getState();
  s.drafts = s.drafts || {};
  if (!values || !values.length) delete s.drafts[stepId];
  else s.drafts[stepId] = { values: values.slice(), ts: Date.now() };
  saveState(s);
  return s.drafts[stepId] || null;
}

function clearDraft(stepId) {
  const s = getState();
  if (s.drafts && s.drafts[stepId]) { delete s.drafts[stepId]; saveState(s); }
  return null;
}

/** 还没"完成本次训练"的总组数（首页用来提示用户） */
function pendingSets() {
  const drafts = getState().drafts || {};
  return Object.keys(drafts).reduce((n, k) => n + ((drafts[k].values || []).length), 0);
}

function pendingList() {
  const drafts = getState().drafts || {};
  return Object.keys(drafts).map(k => ({ stepId: k, values: drafts[k].values || [], ts: drafts[k].ts || 0 }));
}

/** 诊断用：当前用的是真存储还是内存降级、里面有多少条记录、最近有无异常 */
function storageInfo() {
  const w = wxCtx();
  const raw = rawGet();
  const drafts = (raw && raw.drafts) ? raw.drafts : {};
  const info = {
    backend: w ? 'wx.storage' : 'memory(降级!)',
    key: KEY,
    sessions: (raw && raw.sessions) ? raw.sessions.length : 0,
    arts: (raw && raw.arts) ? Object.keys(raw.arts).length : 0,
    passed: (raw && raw.steps) ? Object.keys(raw.steps).length : 0,
    drafts: Object.keys(drafts).length,
    pending: Object.keys(drafts).reduce((n, k) => n + ((drafts[k].values || []).length), 0),
    error: lastError
  };
  if (w && typeof w.getStorageInfoSync === 'function') {
    try {
      const si = w.getStorageInfoSync();
      info.keys = (si.keys || []).length;
      info.sizeKB = si.currentSize;
      info.limitKB = si.limitSize;
    } catch (e) { info.error = info.error || ('getStorageInfoSync 失败：' + ((e && e.message) || e)); }
  }
  return info;
}

function emptyState() {
  return { version: 2, arts: {}, sessions: [], drafts: {}, steps: {}, debug: null };
}

function getState() {
  const s = rawGet();
  if (!s || typeof s !== 'object') return emptyState();
  return {
    version: 2,
    arts: s.arts || {},
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    drafts: (s.drafts && typeof s.drafts === 'object') ? s.drafts : {},
    // steps：每一式"是否已通过（达成升级标准）"——**这是唯一的进度真相**。
    // 以前还存了一个 currentNo（用户选中的式），现在删掉了：
    // 当前式 = 第一个没通过的式，由 steps 推导（见 utils/progress.js 的 currentNo）。
    // 少一个状态源 = 少一整类"状态不跟随"的 bug。
    steps: (s.steps && typeof s.steps === 'object') ? s.steps : {},
    debug: s.debug || null
  };
}

function saveState(s) { rawSet(s); return s; }

/** 是否已通关（第十式达成升级标准） */
function isCompleted(artId) {
  const s = getState();
  return !!(s.arts[artId] && s.arts[artId].completed);
}

function setCompleted(artId, value) {
  const s = getState();
  s.arts[artId] = Object.assign({}, s.arts[artId], {
    completed: !!value,
    completedAt: value ? Date.now() : null,
    lastCompletedAt: value ? Date.now() : null
  });
  return saveState(s);
}

/**
 * 通关：十式全部达标 —— 只记里程碑，不动"当前式"（它是推导出来的）
 * completedAt 保留"首次通关时间"（里程碑，复习时不覆盖），lastCompletedAt 记最近一次
 */
function completeArt(artId) {
  const s = getState();
  const prev = s.arts[artId] || {};
  s.arts[artId] = Object.assign({}, prev, {
    completed: true,
    completedAt: prev.completedAt || Date.now(),
    lastCompletedAt: Date.now()
  });
  return saveState(s);
}

/**
 * 重置某个艺的进度（连同通关状态、通关时间、本艺未提交的草稿）
 *
 * 为什么连草稿一起清：草稿会让式子保持"进行中"，重置后进度归 0 却还留着"进行中"，
 * 自相矛盾。训练记录（sessions）仍然保留，那是历史。
 */
function resetArt(artId, stepIds) {
  const s = getState();
  const prev = s.arts[artId] || {};
  const next = Object.assign({}, prev, { completed: false, completedAt: null, lastCompletedAt: null });
  delete next.currentNo;   // 老数据里的字段，一并清掉
  s.arts[artId] = next;
  (stepIds || []).forEach(id => {
    if (s.steps) delete s.steps[id];
    if (s.drafts) delete s.drafts[id];
  });
  return saveState(s);
}

/* ---------------- 每一式的"已通过"状态（按式独立） ---------------- */

function passedMap() {
  return getState().steps || {};
}

function isStepPassed(stepId) {
  return !!(getState().steps || {})[stepId];
}

function setStepPassed(stepId, value) {
  const s = getState();
  s.steps = s.steps || {};
  if (value) s.steps[stepId] = { passedAt: Date.now() };
  else delete s.steps[stepId];
  return saveState(s);
}

/* ---------------- 调试/验收用：造进度与还原（正式版隐藏入口） ---------------- */

/**
 * 备份"真实进度"，只备份一次（连点调试不会把备份覆盖成调试态）
 * @returns {boolean} 是否新做了备份
 */
function debugSnapshot() {
  const s = getState();
  if (s.debug && s.debug.snapshot) return false;
  s.debug = {
    at: Date.now(),
    snapshot: {
      steps: JSON.parse(JSON.stringify(s.steps || {})),
      arts: JSON.parse(JSON.stringify(s.arts || {}))
    }
  };
  saveState(s);
  return true;
}

/** 把某个艺解锁到第 no 式：1..no-1 记为已通过，no..末式清掉 */
function debugUnlockTo(artId, no, stepIds) {
  debugSnapshot();
  const s = getState();
  s.steps = s.steps || {};
  (stepIds || []).forEach((id, i) => {
    if (i < no - 1) s.steps[id] = s.steps[id] || { passedAt: Date.now() };
    else delete s.steps[id];
  });
  const prev = s.arts[artId] || {};
  s.arts[artId] = Object.assign({}, prev, { completed: false, completedAt: null, lastCompletedAt: null });
  saveState(s);
  return s.steps;
}

/** 六艺全部通关（演示"全通关"长什么样） */
function debugUnlockAll(arts) {
  debugSnapshot();
  const s = getState();
  s.steps = s.steps || {};
  (arts || []).forEach(a => {
    (a.steps || []).forEach(st => { s.steps[st.id] = s.steps[st.id] || { passedAt: Date.now() }; });
    s.arts[a.id] = Object.assign({}, s.arts[a.id], {
      completed: true,
      completedAt: (s.arts[a.id] && s.arts[a.id].completedAt) || Date.now(),
      lastCompletedAt: Date.now()
    });
  });
  saveState(s);
  return true;
}

/** 还原到备份的真实进度 */
function debugRestore() {
  const s = getState();
  if (!s.debug || !s.debug.snapshot) return false;
  s.steps = s.debug.snapshot.steps || {};
  s.arts = s.debug.snapshot.arts || {};
  s.debug = null;
  saveState(s);
  return true;
}

function hasDebugSnapshot() {
  const s = getState();
  return !!(s.debug && s.debug.snapshot);
}

/** 追加一次训练记录 */
function addSession(session) {
  const s = getState();
  const rec = Object.assign({ ts: Date.now() }, session);
  s.sessions.push(rec);
  if (s.sessions.length > 500) s.sessions = s.sessions.slice(-500); // 防止无限增长
  s.arts[session.artId] = Object.assign({}, s.arts[session.artId], {
    lastTs: rec.ts,
    lastStepId: session.stepId
  });
  saveState(s);
  return rec;
}

function sessionsOf(artId) {
  return getState().sessions.filter(x => !artId || x.artId === artId);
}

function recentSessions(n) {
  return getState().sessions.slice().sort((a, b) => b.ts - a.ts).slice(0, n || 5);
}

function reset() { saveState(emptyState()); }

module.exports = {
  getState, saveState,
  isCompleted, setCompleted, completeArt, resetArt,
  passedMap, isStepPassed, setStepPassed,
  addSession, sessionsOf, recentSessions, reset, storageInfo, KEY,
  getDraft, saveDraft, clearDraft, pendingSets, pendingList,
  debugSnapshot, debugUnlockTo, debugUnlockAll, debugRestore, hasDebugSnapshot
};
