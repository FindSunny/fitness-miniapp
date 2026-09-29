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
    viewText: '侧视',
    lastSummary: null,
    restored: false,
    history: [],
    historyAll: [],
    historyCount: 0,
    historyExpanded: false,
    banner: null
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
      currentNo: store.currentNo(art.id),
      isPassed: store.isStepPassed(step.id),
      completed: store.isCompleted(art.id),
      times: historyAll.length,
      lastTier: historyAll.length ? historyAll[0].tier : null
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
      isPassed: banner.kind === 'passed',
      completed: store.isCompleted(art.id)
    });
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  addSet() {
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
    store.setCurrentNo(art.id, step.no);        // 练了哪一式，当前就跟到哪一式

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

    // ① 没达标：说清结果 + 下一步（练过就算数，列表上会显示"已练 N 次"）
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

    // ② 达标：记为"已通过"
    store.setStepPassed(step.id, true);
    const allPassed = getArt(art.id).steps.every(s => store.isStepPassed(s.id));

    if (allPassed) store.completeArt(art.id);

    if (step.no < art.total) {
      wx.showModal({
        title: allPassed ? '全部完成' : '达标了',
        content: allPassed
          ? `「${art.name}」十式已全部达标，可以换下一艺了。`
          : `已达成【升级】标准，已记为「已通过」。进入第 ${step.no + 1} 式？`,
        confirmText: allPassed ? '看进度' : '进入下一式',
        cancelText: allPassed ? '再练一次' : '留在本式',
        success: r => {
          if (allPassed) { if (r.confirm) wx.navigateBack(); return; }
          if (r.confirm) {
            store.advance(art.id, art.total);
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

  goPrev() {
    if (!this.data.canPrev) return;
    const no = this.no - 1;
    store.setCurrentNo(this.artId, no);   // 用户主动选式 → 当前式跟过去
    wx.redirectTo({ url: `/pages/step/step?artId=${this.artId}&no=${no}` });
  },

  goNext() {
    if (!this.data.canNext) return;
    const no = this.no + 1;
    store.setCurrentNo(this.artId, no);
    wx.redirectTo({ url: `/pages/step/step?artId=${this.artId}&no=${no}` });
  }
});
