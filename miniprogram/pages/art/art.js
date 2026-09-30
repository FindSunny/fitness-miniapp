const { getArt } = require('../../data/arts.js');
const progress = require('../../utils/progress.js');
const store = require('../../utils/store.js');
const env = require('../../utils/env.js');

Page({
  data: {
    art: null, steps: [], status: null, completed: false,
    practicedCount: 0, sessionsTotal: 0, lockedCount: 0,
    debugEnabled: false, hasDebugSnapshot: false
  },

  onLoad(options) {
    const art = getArt(options.artId || 'pushup');
    if (!art) {
      wx.showToast({ title: '没有这个动作', icon: 'none' });
      return;
    }
    this.art = art;
    wx.setNavigationBarTitle({ title: art.name });
  },

  onShow() { this.refresh(); },

  refresh() {
    const art = this.art;
    if (!art) return;

    // 进度真相只有一个：每一式的"已通过"表。当前式 = 第一个未通过的式（推导）
    const passed = store.passedMap();
    const completed = store.isCompleted(art.id);
    const sessions = store.sessionsOf(art.id);
    const drafts = store.pendingList();

    const states = progress.stepStates(art, { passed, completed, sessions, drafts });
    const status = progress.artStatus(art, { passed, completed });

    const steps = art.steps.map((s, i) => Object.assign({
      id: s.id,
      name: s.name,
      en: s.en,
      stdLine: progress.formatStdLine(s),
      perSide: s.perSide,
      unit: s.unit,
      hasArt: !!s.art,
      note: s.note || ''
    }, states[i]));

    this.setData({
      art: {
        id: art.id, name: art.name, en: art.en, focus: art.focus,
        tagline: art.tagline, gear: art.gear || '', source: art.source
      },
      steps,
      completed: status.completed,
      status,
      passedCount: status.passed,
      practicedCount: steps.filter(s => s.times > 0).length,
      lockedCount: steps.filter(s => s.isLocked).length,
      sessionsTotal: sessions.length,
      debugEnabled: env.debugEnabled(),
      hasDebugSnapshot: store.hasDebugSnapshot()
    });
  },

  goStep(e) {
    const no = e.currentTarget.dataset.no;
    wx.navigateTo({ url: `/pages/step/step?artId=${this.art.id}&no=${no}` });
  },

  resetProgress() {
    wx.showModal({
      title: '重置进度',
      content: `把「${this.art.name}」退回第 1 式、并清掉"已通过"标记和未提交的组？训练记录会保留。`,
      success: r => {
        if (r.confirm) {
          store.resetArt(this.art.id, this.art.steps.map(s => s.id));
          this.refresh();
        }
      }
    });
  },

  /* ---- 调试/验收入口（仅开发版、体验版可见）：长按进度卡 ---- */
  onCardLongPress() {
    if (!env.debugEnabled()) return;
    const total = this.art.steps.length;
    const status = this.data.status;
    wx.showModal({
      title: '调试：造进度',
      editable: true,
      placeholderText: `解锁到第几式（1-${total}），当前第 ${status.current} 式`,
      success: r => {
        if (!r.confirm) return;
        const no = Math.min(Math.max(Number(r.content) || 1, 1), total);
        store.debugUnlockTo(this.art.id, no, this.art.steps.map(s => s.id));
        this.refresh();
        wx.showToast({ title: `已解锁到第 ${no} 式`, icon: 'none' });
      }
    });
  },

  restoreDebug() {
    if (!env.debugEnabled()) return;
    store.debugRestore();
    this.refresh();
    wx.showToast({ title: '已还原成真实进度', icon: 'none' });
  }
});
