/**
 * 晋级判定逻辑（纯函数，不依赖 wx，可在 Node 里直接单测）
 *
 * 核心模型
 *   一次训练 = 若干组，每组记录一个数值（次数或秒数）
 *   三档标准各自是 {组数, 数值}：满足"有 N 组都达到 V"才算达成该档
 *   从高到低检查，达成"升级"即可以进入下一式
 */

const { TIER_NAMES } = require('../data/arts.js');

const UNIT_LABEL = { reps: '次', sec: '秒' };

function unitLabel(unit) { return UNIT_LABEL[unit] || '次'; }

function tiersOf(step) {
  return step.std.map((pair, i) => ({
    tier: TIER_NAMES[i],
    index: i,
    sets: pair[0],
    value: pair[1],
    unit: step.unit || 'reps',
    perSide: !!step.perSide
  }));
}

function cleanValues(values) {
  return (values || []).filter(v => typeof v === 'number' && isFinite(v) && v > 0);
}

/** 某一档是否达成 */
function reached(tier, values) {
  return values.filter(v => v >= tier.value).length >= tier.sets;
}

/** 达标所需还差多少 */
function gapTo(tier, values) {
  const done = values.filter(v => v >= tier.value).length;
  return {
    tier: tier.tier,
    setsNeed: Math.max(tier.sets - done, 0),
    valueNeed: tier.value,
    unit: tier.unit,
    perSide: tier.perSide
  };
}

/**
 * 判定一次训练记录
 * @param {object} step   data/arts.js 里的一式
 * @param {number[]} values 每组的数值（次数或秒数）
 * @returns {{tierIndex:number, tier:string|null, best:object|null,
 *            next:object|null, gap:object|null, canAdvance:boolean, valid:number}}
 */
function evaluate(step, values) {
  const vals = cleanValues(values);
  const tiers = tiersOf(step);
  let achieved = -1;
  tiers.forEach((t, i) => { if (reached(t, vals)) achieved = i; });

  const best = achieved >= 0 ? tiers[achieved] : null;
  const next = achieved < tiers.length - 1 ? tiers[achieved + 1] : null;

  return {
    tierIndex: achieved,
    tier: best ? best.tier : null,
    best,
    next,
    gap: next ? gapTo(next, vals) : null,
    canAdvance: achieved === tiers.length - 1,
    valid: vals.length
  };
}

/** 一句人话：给界面直接用（"还差 1 组 × 25 次"是最关键的反馈） */
function gapText(result) {
  if (!result || !result.next) return '已达最高标准，可以进入下一式';
  const g = result.gap;
  const per = g.perSide ? '（每侧）' : '';
  return `距【${g.tier}】还差 ${g.setsNeed} 组 × ${g.valueNeed}${unitLabel(g.unit)}${per}`;
}

/** 当前处在哪一档 */
function tierText(result) {
  if (!result || result.tierIndex < 0) return '还没记录';
  return `当前已达成【${result.tier}】`;
}

/** "3 组 × 50 次" / "1 组 × 30 秒" */
function formatTier(tier) {
  return `${tier.sets} 组 × ${tier.value}${unitLabel(tier.unit)}${tier.perSide ? '（每侧）' : ''}`;
}

/** "初级 1×10 · 中级 2×25 · 升级 3×50" */
function formatStdLine(step) {
  return tiersOf(step)
    .map(t => `${t.tier} ${t.sets}×${t.value}${unitLabel(t.unit)}`)
    .join(' · ');
}

/**
 * 某个艺的进度
 * @param {object} art
 * @param {{currentNo:number, passedCount:number, completed:boolean}} opts
 *   currentNo   当前在练第几式（用户可选）
 *   passedCount 已通过（达成升级标准）的式数
 */
function artStatus(art, opts) {
  const o = opts || {};
  const total = art.steps.length;
  const current = Math.min(Math.max(o.currentNo || 1, 1), total);
  const completed = !!o.completed;
  // 通关 = 十式全部通过（completed 为真时直接算满，兼容只写了 completed 的老数据）
  const passed = completed ? total : Math.min(Math.max(o.passedCount || 0, 0), total);
  return {
    current,
    total,
    done: passed,
    passed,
    percent: Math.round((passed / total) * 100),
    completed: completed || passed >= total,
    atLastStep: current >= total,
    label: (completed || passed >= total) ? '已通关' : `当前第 ${current} 式`
  };
}

/**
 * 首页「继续训练」推荐
 *
 * 规则（按优先级）：
 *   ① 最近练过、且还没通关的艺 → 继续它
 *   ② 否则按六艺顺序取第一个没通关的艺（通关一个就自动顺延到下一个）
 *   ③ 六艺全部通关 → 完成态（all-done）
 *
 * 纯函数：不依赖 store，通过 opts 注入读取方式，便于单测与预览复用。
 * @param {Array} arts
 * @param {{sessions?:Array, currentNoOf?:Function, isCompleted?:Function}} opts
 */
function recommend(arts, opts) {
  const o = opts || {};
  const sessions = (o.sessions || []).slice().sort((a, b) => b.ts - a.ts);
  const currentNoOf = o.currentNoOf || (() => 1);
  const isCompleted = o.isCompleted || (() => false);

  const clamp = (art, no) => Math.min(Math.max(no || 1, 1), art.steps.length);
  const pick = (art, mode, reason) => {
    const no = clamp(art, currentNoOf(art.id));
    return { art, step: art.steps[no - 1], no, mode, reason };
  };

  // ① 最近练过且未通关
  for (const s of sessions) {
    const art = arts.find(a => a.id === s.artId);
    if (art && !isCompleted(art.id)) {
      return pick(art, 'continue', `上次练的是${art.name}`);
    }
  }

  // ② 顺序推进到第一个未通关的艺
  const next = arts.find(a => !isCompleted(a.id));
  if (next) {
    const doneCount = arts.filter(a => isCompleted(a.id)).length;
    const reason = doneCount > 0 ? `已通关 ${doneCount} 艺，接着练${next.name}` : `从${next.name}开始`;
    return pick(next, 'next', reason);
  }

  // ③ 全部通关
  return { art: null, step: null, no: null, mode: 'all-done', reason: '六艺十式已全部通关' };
}

/**
 * 十式列表里每一式的展示状态
 *
 * 两个维度分开：
 *   ① 已通过 = 达成过这一式的升级标准（按式独立记录，不再用"式号 < 当前式"推断）
 *   ② 当前   = 用户正在练的那一式（可以自己选，不必等晋级）
 *   ③ 已练 N 次 = 有训练记录但还没通过
 *
 * @param art
 * @param {{currentNo:number, passed:Object, completed:boolean, sessions:Array<{no,tier,ts}>}} opts
 * @returns [{no, state:'passed'|'current'|'practiced'|'todo', stateText, times, lastTier, lastTs, isCurrent, isPassed}]
 */
function stepStates(art, opts) {
  const o = opts || {};
  const cur = Math.min(Math.max(o.currentNo || 1, 1), art.steps.length);
  const completed = !!o.completed;
  const passedMap = o.passed || {};

  const byNo = {};
  (o.sessions || []).forEach(s => {
    const n = Number(s && s.no);
    if (!n) return;
    const r = byNo[n] || (byNo[n] = { times: 0, lastTier: null, lastTs: 0 });
    r.times += 1;
    if ((s.ts || 0) >= r.lastTs) { r.lastTs = s.ts || 0; r.lastTier = s.tier || null; }
  });

  return art.steps.map(s => {
    const rec = byNo[s.no];
    const isCurrent = !completed && s.no === cur;
    const isPassed = completed || !!passedMap[s.id];
    let state, stateText;
    if (isPassed) {
      state = 'passed'; stateText = '已通过';
    } else if (isCurrent && rec) {
      state = 'current'; stateText = `已练 ${rec.times} 次`;
    } else if (isCurrent) {
      state = 'current'; stateText = '进行中';
    } else if (rec) {
      state = 'practiced'; stateText = `已练 ${rec.times} 次`;
    } else {
      state = 'todo'; stateText = '未开始';
    }
    return {
      no: s.no,
      state,
      stateText,
      isCurrent,
      isPassed,
      times: rec ? rec.times : 0,
      lastTier: rec ? rec.lastTier : null,
      lastTs: rec ? rec.lastTs : 0
    };
  });
}

/**
 * 单式的状态说明（详情页顶部用它告诉用户"这一式现在是什么状态"）
 * @param {object} art @param {object} step
 * @param {{currentNo:number, isPassed:boolean, completed:boolean, times:number, lastTier:string}} o
 */
function stepBanner(art, step, o) {
  const opts = o || {};
  const total = art.steps.length;
  if (opts.completed || opts.isPassed) {
    return {
      kind: 'passed',
      title: '✓ 已通过这一式',
      sub: opts.completed
        ? '本艺十式已全部达标'
        : (step.no < total ? `可以进入第 ${step.no + 1} 式继续` : '这是最后一式')
    };
  }
  if (step.no === opts.currentNo) {
    return {
      kind: 'current',
      title: '当前在练这一式',
      sub: opts.times ? `已练 ${opts.times} 次${opts.lastTier ? ' · 最近：' + opts.lastTier : ''}` : '还没有提交过记录'
    };
  }
  if (step.no < opts.currentNo) {
    return { kind: 'behind', title: `还没通过这一式`, sub: `当前在练第 ${opts.currentNo} 式，也可以在这里继续练` };
  }
  return {
    kind: 'ahead',
    title: `这是第 ${step.no} 式（当前在练第 ${opts.currentNo} 式）`,
    sub: opts.times ? `你在这里练过 ${opts.times} 次` : '可以先在这里练，提交后当前式会跟过来'
  };
}

/** 时间格式化：09-29 11:20 */
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 某一次训练记录的人话摘要 */
function sessionText(session, unit) {
  const v = (session && session.values) || [];
  return `${v.length} 组（${v.join(' / ')}）${unitLabel(unit || (session && session.unit))}`;
}

/** 全部记录里最近一次（用于首页"继续训练"） */
function latestSession(sessions) {
  if (!sessions || !sessions.length) return null;
  return sessions.slice().sort((a, b) => b.ts - a.ts)[0];
}

/** 最近 N 天练了几次 */
function countRecentDays(sessions, days, now) {
  const t = now || Date.now();
  const from = t - days * 24 * 3600 * 1000;
  const set = new Set((sessions || []).filter(s => s.ts >= from).map(s => new Date(s.ts).toDateString()));
  return set.size;
}

module.exports = {
  tiersOf, evaluate, reached, gapTo,
  gapText, tierText, formatTier, formatStdLine, artStatus, recommend,
  stepStates, stepBanner, formatTime, sessionText,
  latestSession, countRecentDays, unitLabel, cleanValues
};
