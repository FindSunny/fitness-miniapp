const { ARTS, getArt } = require('../../data/arts.js');
const progress = require('../../utils/progress.js');
const store = require('../../utils/store.js');
const build = require('../../build-info.js');

Page({
  data: {
    arts: [],
    main: null,
    allDone: false,
    completedCount: 0,
    weeklyCount: 0,
    totalSessions: 0,
    storeInfo: null,
    build
  },

  onShow() {
    const sessions = store.getState().sessions;

    const arts = ARTS.map(a => {
      const cur = store.currentNo(a.id);
      const completed = store.isCompleted(a.id);
      const passedCount = a.steps.filter(s => store.isStepPassed(s.id)).length;
      const st = progress.artStatus(a, { currentNo: cur, passedCount, completed });
      return {
        id: a.id,
        name: a.name,
        en: a.en,
        focus: a.focus,
        tagline: a.tagline,
        cover: `/assets/movements/art-${a.id}.png`,
        currentNo: cur,
        total: st.total,
        percent: st.percent,
        completed: st.completed,
        label: st.label,
        passedCount,
        // 该艺有几式的示意图已经画好（mov-* 是逐式图；art-* 是六艺共用封面，不算）
        drawn: a.steps.filter(s => s.art && s.art.indexOf('mov-') === 0).length
      };
    });

    // 推荐：跳过已通关的艺，通关一个就自动顺延到下一个
    const rec = progress.recommend(ARTS, {
      sessions,
      currentNoOf: id => store.currentNo(id),
      isCompleted: id => store.isCompleted(id)
    });

    const main = rec.mode === 'all-done' ? null : {
      artId: rec.art.id,
      artName: rec.art.name,
      no: rec.no,
      stepName: rec.step.name,
      stdLine: progress.formatStdLine(rec.step),
      mode: rec.mode,
      title: rec.mode === 'continue' ? '继续训练' : '接着练',
      reason: rec.reason
    };

    this.setData({
      arts,
      main,
      allDone: rec.mode === 'all-done',
      completedCount: ARTS.filter(a => store.isCompleted(a.id)).length,
      weeklyCount: progress.countRecentDays(sessions, 7),
      totalSessions: sessions.length,
      // 诊断用：真机上看不清"数据为什么没了"时，这行能直接给出答案
      storeInfo: store.storageInfo(),
      // 已记录但还没提交的组（每组都即时落盘，这里提示用户去提交）
      pendingSets: store.pendingSets(),
      pendingList: store.pendingList()
    });
  },

  goArt(e) {
    wx.navigateTo({ url: `/pages/art/art?artId=${e.currentTarget.dataset.id}` });
  },

  /** 从"未提交的组"提示直接跳到对应动作 */
  goStepById(e) {
    const m = /^([a-z]+)-(\d+)$/.exec(e.currentTarget.dataset.id || '');
    if (!m) return;
    wx.navigateTo({ url: `/pages/step/step?artId=${m[1]}&no=${Number(m[2])}` });
  },

  goMain() {
    const m = this.data.main;
    if (!m) return;
    wx.navigateTo({ url: `/pages/step/step?artId=${m.artId}&no=${m.no}` });
  }
});
