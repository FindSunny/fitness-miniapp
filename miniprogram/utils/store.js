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
  return { version: 2, arts: {}, sessions: [], drafts: {}, steps: {} };
}

function getState() {
  const s = rawGet();
  if (!s || typeof s !== 'object') return emptyState();
  return {
    version: 2,
    arts: s.arts || {},
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    drafts: (s.drafts && typeof s.drafts === 'object') ? s.drafts : {},
    // steps：每一式"是否已通过（达成升级标准）"——按式独立记录，
    // 不再用"式号 < 当前式"推断（那样用户手动选式就乱了）
    steps: (s.steps && typeof s.steps === 'object') ? s.steps : {}
  };
}

function saveState(s) { rawSet(s); return s; }

/** 某个艺当前练到第几式（默认第 1 式） */
function currentNo(artId) {
  const s = getState();
  return (s.arts[artId] && s.arts[artId].currentNo) || 1;
}

function setCurrentNo(artId, no) {
  const s = getState();
  s.arts[artId] = Object.assign({}, s.arts[artId], { currentNo: no });
  return saveState(s);
}

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
 * 通关：当前已是第十式且达标 —— 不前进，而是标记完成
 * completedAt 保留"首次通关时间"（里程碑，复习时不覆盖），lastCompletedAt 记最近一次
 */
function completeArt(artId) {
  const s = getState();
  const prev = s.arts[artId] || {};
  s.arts[artId] = Object.assign({}, prev, {
    currentNo: prev.currentNo || 10,
    completed: true,
    completedAt: prev.completedAt || Date.now(),
    lastCompletedAt: Date.now()
  });
  return saveState(s);
}

/** 重置某个艺的进度（连同通关状态与通关时间） */
function resetArt(artId, stepIds) {
  const s = getState();
  s.arts[artId] = Object.assign({}, s.arts[artId], {
    currentNo: 1, completed: false, completedAt: null, lastCompletedAt: null
  });
  (stepIds || []).forEach(id => { if (s.steps) delete s.steps[id]; });
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

/** 晋级到下一式（返回新的式号；已在第 10 式则保持不变） */
function advance(artId, total) {
  const cur = currentNo(artId);
  const next = Math.min(cur + 1, total || 10);
  setCurrentNo(artId, next);
  return next;
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
  getState, saveState, currentNo, setCurrentNo, advance,
  isCompleted, setCompleted, completeArt, resetArt,
  passedMap, isStepPassed, setStepPassed,
  addSession, sessionsOf, recentSessions, reset, storageInfo, KEY,
  getDraft, saveDraft, clearDraft, pendingSets, pendingList
};
