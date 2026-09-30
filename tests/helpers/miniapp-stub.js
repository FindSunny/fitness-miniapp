/**
 * 小程序运行环境打桩：让页面代码能在 Node 里被真实驱动
 *
 * 为什么需要：纯函数单测抓不到"页面把数据拼错了"这类 bug
 * （实际踩过两个：第十式无法通关、通关后首页仍推荐该艺）。
 * 有了这层，就能直接调页面的 onLoad / onShow / finish，断言真实行为。
 *
 * 用法：
 *   const env = require('./helpers/miniapp-stub.js').install();
 *   const page = env.load(path.join(__dirname, '../miniprogram/pages/index/index.js'));
 *   page.onShow();
 *   assert.strictEqual(page.data.main.artId, 'squat');
 *   env.answerModal(true);        // 回答弹出的 modal
 */
function install() {
  const storage = {};
  const calls = { toast: [], modal: [], nav: [], title: [], sheet: [] };
  const pendingModals = [];
  const pendingSheets = [];
  // 默认 develop（开发版）：调试入口可见 —— npm test / E2E 要能覆盖调试入口本身
  let envVersion = 'develop';

  global.wx = {
    getStorageSync: k => storage[k],
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: k => { delete storage[k]; },
    getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
    showToast: o => { calls.toast.push(o); },
    showModal: o => { calls.modal.push(o); pendingModals.push(o); },
    navigateTo: o => { calls.nav.push(o); },
    redirectTo: o => { calls.nav.push(o); },
    navigateBack: () => { calls.nav.push({ back: true }); },
    setNavigationBarTitle: o => { calls.title.push(o); },
    showActionSheet: o => { calls.sheet.push(o); pendingSheets.push(o); }
  };

  let lastDef = null;
  global.Page = def => { lastDef = def; };
  global.App = () => {};
  global.getCurrentPages = () => [];

  return {
    calls,
    storage,
    /** 切换运行环境：develop（默认）/ trial（体验版）/ release（正式版） */
    setEnvVersion(v) { envVersion = v; },
    /** 装载一个页面模块，返回可直接调用的页面实例（带 setData） */
    load(absPath) {
      delete require.cache[require.resolve(absPath)];
      require(absPath);
      if (!lastDef) throw new Error('页面没有调用 Page()：' + absPath);
      const inst = Object.create(lastDef);
      inst.data = JSON.parse(JSON.stringify(lastDef.data || {}));
      inst.setData = function (patch) { Object.assign(inst.data, patch); };
      inst.__def = lastDef;
      return inst;
    },
    /** 回答最近一个未处理的 modal */
    answerModal(confirm) {
      const o = pendingModals.shift();
      if (!o || !o.success) return null;
      o.success({ confirm: !!confirm, cancel: !confirm });
      return o;
    },
    /** 回答最近一个未处理的 actionSheet（传被点的序号） */
    answerSheet(tapIndex) {
      const o = pendingSheets.shift();
      if (!o || !o.success) return null;
      o.success({ tapIndex: tapIndex || 0 });
      return o;
    },
    resetCalls() {
      calls.toast.length = 0; calls.modal.length = 0; calls.nav.length = 0;
      calls.title.length = 0; calls.sheet.length = 0;
      pendingModals.length = 0; pendingSheets.length = 0;
    }
  };
}

module.exports = { install };
