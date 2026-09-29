const { getArt, getStep } = require('../../data/arts.js');
const progress = require('../../utils/progress.js');
const store = require('../../utils/store.js');

const HISTORY_SHOW = 3;   // 默认只显示最近几条，避免把页面撑长

Page({
  data: {
    art: null,
    step: null,
    no: 1,
    values: [],
    input: '',
    tiers: [],
    result: null,
    tierText: '',
    gapText: '',
    unitLabel: '次',
    canPrev: false,
    canNext: false,
    isLast: false,
    completed: false,
    isPassed: false,
    isCurrent: false,
    locked: false,
    lockHint: '',
    currentNo: 1,
    viewText: '侧视',
    lastSummary: null,
    restored: false,
    history: [],
    historyAll: [],
    historyCount: 0,
    historyExpanded: false,
    banner: null,
    bigPose: false
  },

  onLoad(options) {
    this.artId = options.artId || 'pushup';
    this.no = Number(options.no || 1);
    const art = getArt(this.artId);
    if (art) wx.setNavigationBarTitle({ title: `${art.name} · 第 ${this.no} 式` });
    this.load();
  },

  load() {
    const art = getArt(this.artId);
    const step = getStep(this.artId, this.no);
    if (!art || !step) {
      wx.showToast({ title: '没有这一式', icon: 'none' });
      return;
    }
    const draft = store.getDraft(step.id);
    const values = draft ? draft.values.slice() : [];
    this.setData({
      art: { id: art.id, name: art.name, en: art.en, total: art.steps.length },
      step,
      no: this.no,
      values,
      input: '',
      restored: values.length > 0,
      historyExpanded: false,
      bigPose: false,
      unitLabel: progress.unitLabel(step.unit),
      canPrev: this.no > 1,
      canNext: this.no < art.steps.length,
      isLast: this.no === art.steps.length,
      completed: store.isCompleted(art.id),
      viewText: step.view === 'top' ? '俯视（从上往下看）' : (step.view === 'front' ? '正视' : '侧视')
    });
    this.refresh();
  },

  refresh() {
    const { step, values, historyExpanded } = this.data;
    if (!step) return;
    const art = getArt(this.artId);
    const result = progress.evaluate(step, values);
    const tiers = progress.tiersOf(step).map((t, i) => Object.assign({}, t, {
      text: progress.formatTier(t),
      done: i <= result.tierIndex,
      reached: i === result.tierIndex
    }));

    // 进度真相：已通过的式表；当前式 = 第一个未通过的式（推导）
    const passed = store.passedMap();
    const completed = store.isCompleted(art.id);
    const curNo = progress.currentNo(art, { passed, completed });
    const isPassed = !!passed[step.id];
    const isCurrent = !completed && curNo === step.no;
    // 锁定式推进：只有"已通过的式"和"当前式"能记录，再往后只能看
    const locked = !progress.canPractice(art, step, { passed, completed });
    // 解锁提示要说"还差多少才能过"，不能拿【初级】的门槛糊弄人
    // （踩过：这里曾用 evaluate(step, []) 的 gap，显示成"距【初级】还差 1 组 × 10次"，
    //   而真正要达标的是【升级】档）
    const curStep = curNo ? getStep(this.artId, curNo) : null;
    let lockHint = '';
    if (locked && curStep) {
      const t = progress.tiersOf(curStep);
      const top = t[t.length - 1];
      lockHint = `先通过第 ${curNo} 式（${curStep.name}）—— 达标标准【${top.tier}】${progress.formatTier(top)}`;
    }

    // 这一式的历史记录（持久化在本地，重进页面必须能看到）
    const historyAll = store.sessionsOf(step.artId)
      .filter(s => s.no === step.no)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .map(s => ({
        ts: s.ts,
        tsText: progress.formatTime(s.ts),
        setsText: (s.values || []).join(' / '),
        count: (s.values || []).length,
        tier: s.tier || '未达档',
        unitLabel: progress.unitLabel(s.unit || step.unit)
      }));
    const history = historyExpanded ? historyAll : historyAll.slice(0, HISTORY_SHOW);

    // 顶部状态横幅：让用户一眼知道"这一式现在是什么状态"
    const banner = progress.stepBanner(art, step, {
      isPassed,
      isCurrent,
      completed,
      times: historyAll.length,
      lastTier: historyAll.length ? historyAll[0].tier : null,
      unlockHint: lockHint
    });

    this.setData({
      result,
      tiers,
      tierText: progress.tierText(result),
      gapText: progress.gapText(result),
      historyAll,
      history,
      historyCount: historyAll.length,
      historyMore: Math.max(historyAll.length - history.length, 0),
      banner,
      isPassed,
      isCurrent,
      locked,
      lockHint,
      currentNo: curNo || art.steps.length,
      completed
    });
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  /** 点示意图 → 全屏看大图 */
  openPose() {
    if (!this.data.step || !this.data.step.art) return;
    this.setData({ bigPose: true });
  },

  closePose() { this.setData({ bigPose: false }); },

  /** 遮罩上拦一下滑动，避免大图后面跟着滚（catchtouchmove 要求有个处理函数） */
  noop() {},

  addSet() {
    if (this.data.locked) {
      wx.showToast({ title: `先通过第 ${this.data.currentNo} 式`, icon: 'none' });
      return;
    }
    const v = Number(this.data.input);
    if (!v || v <= 0) {
      wx.showToast({ title: `先填入${this.data.unitLabel}数`, icon: 'none' });
      return;
    }
    const values = this.data.values.concat([v]);
    this.setData({ values, input: '', restored: false });
    store.saveDraft(this.data.step.id, values);   // 立刻落盘
    this.refresh();
  },

  /**
   * 按某一档标准一键填入（访谈里的头号诉求：不想逐组手输）
   * 覆盖当前未提交的组 —— "点中级"的意思就是"我这次做到中级标准"
   */
  applyTier(e) {
    if (this.data.locked) {
      wx.showToast({ title: `先通过第 ${this.data.currentNo} 式`, icon: 'none' });
      return;
    }
    const t = this.data.tiers[Number(e.currentTarget.dataset.i)];
    if (!t) return;
    const values = [];
    for (let i = 0; i < t.sets; i++) values.push(t.value);
    this.setData({ values, input: '', restored: false });
    store.saveDraft(this.data.step.id, values);
    this.refresh();
    wx.showToast({ title: `已按【${t.tier}】填入 ${t.sets} 组`, icon: 'none' });
  },

  removeSet(e) {
    const i = Number(e.currentTarget.dataset.i);
    const values = this.data.values.slice();
    values.splice(i, 1);
    this.setData({ values });
    store.saveDraft(this.data.step.id, values);
    this.refresh();
  },

  clearSets() {
    this.setData({ values: [] });
    store.clearDraft(this.data.step.id);
    this.refresh();
  },

  toggleHistory() {
    this.setData({ historyExpanded: !this.data.historyExpanded });
    this.refresh();
  },

  finish() {
    const { art, step, values, result } = this.data;
    if (this.data.locked) {
      wx.showToast({ title: `先通过第 ${this.data.currentNo} 式`, icon: 'none' });
      return;
    }
    if (!values.length) {
      wx.showToast({ title: '先记至少一组', icon: 'none' });
      return;
    }
    const rec = store.addSession({
      artId: art.id,
      stepId: step.id,
      no: step.no,
      values: values.slice(),
      unit: step.unit,
      perSide: step.perSide,
      tierIndex: result.tierIndex,
      tier: result.tier
    });
    store.clearDraft(step.id);                  // 已转成正式记录
    // 注意：这里不再需要"推进当前式"——当前式 = 第一个未通过的式，是推导出来的。
    // 达标写入 steps 之后，下一式自动变成进行中（不管用户点不点弹窗按钮）。

    const info = store.storageInfo();
    const savedLine = info.error
      ? `⚠ 保存异常：${info.error}`
      : `已保存到本机（本式共 ${store.sessionsOf(art.id).filter(s => s.no === step.no).length} 次 · ${info.backend}）`;

    this.setData({
      lastSummary: {
        setsText: values.join(' / '),
        count: values.length,
        unitLabel: progress.unitLabel(step.unit),
        tierText: progress.tierText(result),
        gapText: progress.gapText(result),
        savedLine,
        savedOk: !info.error,
        at: rec.ts
      },
      values: []
    });
    this.refresh();

    // ① 没达标：说清结果 + 下一步（记录已保存，当前式不变，继续练这一式）
    if (!result.canAdvance) {
      wx.showModal({
        title: info.error ? '保存可能失败' : '本次已记录',
        content: `${values.length} 组（${values.join(' / ')}）${progress.unitLabel(step.unit)}\n` +
                 `${progress.tierText(result)}\n${progress.gapText(result)}\n${savedLine}`,
        confirmText: '再练一组',
        cancelText: '回十式列表',
        success: r => { if (!r.confirm) wx.navigateBack(); }
      });
      return;
    }

    // ② 达标：记为"已通过"→ 下一式自动成为进行中
    store.setStepPassed(step.id, true);
    const allPassed = getArt(art.id).steps.every(s => store.isStepPassed(s.id));

    if (allPassed) store.completeArt(art.id);

    if (step.no < art.total) {
      wx.showModal({
        title: allPassed ? '全部完成' : '达标了',
        content: allPassed
          ? `「${art.name}」十式已全部达标，可以换下一艺了。`
          : `已达成【升级】标准，已记为「已通过」。第 ${step.no + 1} 式已解锁，现在去练？`,
        confirmText: allPassed ? '看进度' : '去练下一式',
        cancelText: allPassed ? '再练一次' : '留在本式',
        success: r => {
          if (allPassed) { if (r.confirm) wx.navigateBack(); return; }
          if (r.confirm) {
            wx.redirectTo({ url: `/pages/step/step?artId=${art.id}&no=${step.no + 1}` });
          } else {
            this.refresh();
          }
        }
      });
      return;
    }

    // ③ 最后一式达标（注意：只有十式全通过才算通关）
    const passedCount = getArt(art.id).steps.filter(s => store.isStepPassed(s.id)).length;
    wx.showModal({
      title: allPassed ? '全部完成' : '这一式已通过',
      content: allPassed
        ? `「${art.name}」十式已全部达标，可以换下一艺了。`
        : `第 ${step.no} 式已记为「已通过」。本艺还有 ${art.total - passedCount} 式没通过，可以回列表补齐。`,
      confirmText: allPassed ? '看进度' : '回十式列表',
      cancelText: allPassed ? '再练一次' : '留在这里',
      success: r => { if (r.confirm) wx.navigateBack(); else this.refresh(); }
    });
  },

  /**
   * 上一式 / 下一式：**纯浏览**，不改任何进度
   * （锁定式推进下，"当前式"是推导的，用户点谁都不会改变它；
   *   想解锁更靠后的式，只有把当前式练到达标）
   */
  goPrev() {
    if (!this.data.canPrev) return;
    wx.redirectTo({ url: `/pages/step/step?artId=${this.artId}&no=${this.no - 1}` });
  },

  goNext() {
    if (!this.data.canNext) return;
    wx.redirectTo({ url: `/pages/step/step?artId=${this.artId}&no=${this.no + 1}` });
  },

  /** 从"未解锁"的页面一键回到当前该练的那一式 */
  goCurrent() {
    wx.redirectTo({ url: `/pages/step/step?artId=${this.artId}&no=${this.data.currentNo}` });
  }
});
