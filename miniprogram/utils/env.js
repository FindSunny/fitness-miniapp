/**
 * 运行环境判断（用来决定"调试入口"显不显示）
 *
 * 微信小程序有 develop（开发版）/ trial（体验版）/ release（正式版）三种环境。
 * 调试入口只在前两种出现 —— 正式版里长按没有任何反应，避免把验收用的后门带到线上。
 *
 * 拿不到环境信息时（Node 测试、网页预览）按"开发环境"处理：调试入口可用。
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

/** 是否允许显示调试入口 */
function debugEnabled() {
  return envVersion() !== 'release';
}

module.exports = { envVersion, debugEnabled };
