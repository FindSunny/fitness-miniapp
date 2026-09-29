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
  const calls = { toast: [], modal: [], nav: [], title: [] };
  const pendingModals = [];

  global.wx = {
    getStorageSync: k => storage[k],
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: k => { delete storage[k]; },
    showToast: o => { calls.toast.push(o); },
    showModal: o => { calls.modal.push(o); pendingModals.push(o); },
    navigateTo: o => { calls.nav.push(o); },
    redirectTo: o => { calls.nav.push(o); },
    navigateBack: () => { calls.nav.push({ back: true }); },
    setNavigationBarTitle: o => { calls.title.push(o); }
  };

  let lastDef = null;
  global.Page = def => { lastDef = def; };
  global.App = () => {};
  global.getCurrentPages = () => [];

  return {
    calls,
    storage,
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
    resetCalls() {
      calls.toast.length = 0; calls.modal.length = 0; calls.nav.length = 0; calls.title.length = 0;
      pendingModals.length = 0;
    }
  };
}

module.exports = { install };
