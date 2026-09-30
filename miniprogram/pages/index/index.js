const { ARTS, getArt } = require('../../data/arts.js');
const progress = require('../../utils/progress.js');
const store = require('../../utils/store.js');
const env = require('../../utils/env.js');
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
    debugEnabled: false,
    hasDebugSnapshot: false,
    build
  },

  onShow() {
    const sessions = store.getState().sessions;

    // 当前式是推导的：第一个还没通过的式
    const passed = store.passedMap();
    const curOf = {};
    ARTS.forEach(a => { curOf[a.id] = progress.currentNo(a, { passed, completed: store.isCompleted(a.id) }); });

    const arts = ARTS.map(a => {
      const completed = store.isCompleted(a.id);
      const artSessions = sessions.filter(s => s.artId === a.id);
      const st = progress.artStatus(a, { passed, completed, sessions: artSessions });
      const cur = curOf[a.id];
      return {
        id: a.id,
        name: a.name,
        en: a.en,
        focus: a.focus,
        tagline: a.tagline,
        cover: `/assets/movements/art-${a.id}.png`,
        currentNo: cur === null ? a.steps.length : cur,
        total: st.total,
        percent: st.percent,
        completed: st.completed,
        // label 太长的时代已经过去：卡片窄，只显示短状态 + 数字
        stateText: st.stateText,
        stateClass: st.completed ? 'done' : (st.started ? 'doing' : 'todo'),
        label: st.label,
        started: st.started,
        passedCount: st.passed,
        // 该艺有几式的示意图已经画好（mov-* 是逐式图；art-* 是六艺共用封面，不算）
        drawn: a.steps.filter(s => s.art && s.art.indexOf('mov-') === 0).length
      };
    });

    // 推荐：跳过已通关的艺，通关一个就自动顺延到下一个
    const rec = progress.recommend(ARTS, {
      sessions,
      currentNoOf: id => curOf[id],
      isCompleted: id => store.isCompleted(id)
    });

    const main = rec.mode === 'all-done' ? null : {
      artId: rec.art.id,
      artName: rec.art.name,
      no: rec.no,
      stepName: rec.step.name,
      stdLine: progress.formatStdLine(rec.step),
      mode: rec.mode,
      // 一个字的问题也别糊弄：一次都没练过的人，看到"接着练"是错的
      // （同一类 bug：文案按"推荐算法的分支"写，而不是按用户的状态写）
      title: rec.mode === 'continue' ? '继续训练' : (sessions.length ? '接着练' : '开始训练'),
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
      debugEnabled: env.debugEnabled(),
      hasDebugSnapshot: store.hasDebugSnapshot(),
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
  },

  /** 极简模式入口：同一个式子，但详情页会显示"记几组就提交、不用等达标" */
  goMainQuick() {
    const m = this.data.main;
    if (!m) return;
    wx.navigateTo({ url: `/pages/step/step?artId=${m.artId}&no=${m.no}&quick=1` });
  },

  /**
   * 分享卡片（回应 R2 访谈排第一的放弃原因"没人陪着练"）
   * 纯前端能力：0 后端、0 域名。真的搭子/排行榜要好友关系，已记入 v2。
   */
  onShareAppMessage() {
    const m = this.data.main;
    return {
      title: m
        ? `我在练「${m.artName} · 第 ${m.no} 式」，一起来？`
        : '六艺十式 · 在家徒手健身，六个动作各十式',
      path: m ? `/pages/step/step?artId=${m.artId}&no=${m.no}` : '/pages/index/index'
    };
  },

  /* ---- 调试/验收入口（仅开发版、体验版可见）：长按 build 信息行 ---- */
  onBuildLongPress() {
    if (!env.debugEnabled()) return;
    const items = this.data.hasDebugSnapshot
      ? ['调试：六艺全部通关', '调试：还原成真实进度']
      : ['调试：六艺全部通关'];
    wx.showActionSheet({
      itemList: items,
      success: r => {
        if (r.tapIndex === 0) {
          store.debugUnlockAll(ARTS);
          wx.showToast({ title: '已造出全通关态', icon: 'none' });
        } else {
          store.debugRestore();
          wx.showToast({ title: '已还原成真实进度', icon: 'none' });
        }
        this.onShow();
      }
    });
  }
});
