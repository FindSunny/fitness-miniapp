/**
 * 运行环境判断（用来决定"调试信息 / 调试入口"显不显示）
 *
 * 微信小程序有 develop（开发版）/ trial（体验版）/ release（正式版）三种环境。
 *
 * 规则（上线前收紧过一次，见 ACCEPTANCE.md 第 35 项）：
 *   调试信息**只在开发版**出现 —— 体验版和正式版都不显示。
 *   原来写的是 `!== 'release'`（体验版也算"非正式版"），结果是：**你把体验版发给朋友，
 *   朋友第一眼看到的是"build xxx ｜ 存储：wx.storage ｜ 记录 3 条 ｜ 已用 12 KB"**。
 *   体验版是给外人看的，它必须和正式版一样干净。
 *
 * 版本号不靠这个开关：首页底部那条 `v0.1.6` 是**所有环境都显示**的正常产品信息。
 *
 * 拿不到环境信息时（Node 测试、网页预览）按"开发版"处理：调试入口可用，
 * 这样 npm test / E2E 才能覆盖到调试入口本身。
 */
function envVersion() {
  try {
    const info = wx.getAccountInfoSync();
    const v = info && info.miniProgram && info.miniProgram.envVersion;
    return v || 'develop';
  } catch (e) {
    return 'develop';
  }
}

/** 是否允许显示调试信息与调试入口（只有开发版） */
function debugEnabled() {
  return envVersion() === 'develop';
}

module.exports = { envVersion, debugEnabled };
