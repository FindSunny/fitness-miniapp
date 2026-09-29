const { getArt } = require('../../data/arts.js');
const progress = require('../../utils/progress.js');
const store = require('../../utils/store.js');

Page({
  data: { art: null, steps: [], currentNo: 1, status: null, completed: false, practicedCount: 0, sessionsTotal: 0 },

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

    const cur = store.currentNo(art.id);
    const completed = store.isCompleted(art.id);
    const sessions = store.sessionsOf(art.id);
    const passed = store.passedMap();

    // 每一式的状态 = "是否通过" + "是否练过"（两件事分开显示）
    const states = progress.stepStates(art, { currentNo: cur, passed, completed, sessions });
    const passedCount = states.filter(s => s.isPassed).length;
    const status = progress.artStatus(art, { currentNo: cur, passedCount, completed });

    const steps = art.steps.map((s, i) => Object.assign({
      id: s.id,
      name: s.name,
      en: s.en,
      stdLine: progress.formatStdLine(s),
      perSide: s.perSide,
      unit: s.unit,
      hasArt: !!s.art,
      note: s.note || ''
    }, states[i], {
      note2: states[i].lastTier ? `最近：${states[i].lastTier}` : ''
    }));

    const practicedCount = steps.filter(s => s.times > 0).length;

    this.setData({
      art: {
        id: art.id, name: art.name, en: art.en, focus: art.focus,
        tagline: art.tagline, source: art.source
      },
      steps,
      currentNo: cur,
      completed: status.completed,
      status,
      passedCount,
      practicedCount,
      sessionsTotal: sessions.length
    });
  },

  goStep(e) {
    const no = e.currentTarget.dataset.no;
    wx.navigateTo({ url: `/pages/step/step?artId=${this.art.id}&no=${no}` });
  },

  resetProgress() {
    wx.showModal({
      title: '重置进度',
      content: `把「${this.art.name}」退回第 1 式、并清掉"已通过"标记？训练记录会保留。`,
      success: r => {
        if (r.confirm) {
          store.resetArt(this.art.id, this.art.steps.map(s => s.id));
          this.refresh();
        }
      }
    });
  }
});
