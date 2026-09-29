/**
 * 构建标记：用来判断"手机上跑的是不是最新包"
 * （预览/开发版很容易加载到旧包，没有标记就只能靠猜）
 *
 * 改代码后手动把这个 stamp 加一，或者跑 `npm run stamp` 自动更新。
 * version 与 package.json 保持一致（`npm run stamp` 会自动同步）；
 * 页面只显示 stamp，version 用于记录"这一版对应哪个发布号"。
 */
module.exports = {
  version: '0.1.5',
  stamp: '2026-09-29.10',   // 每次改动 +1
  note: '锁定式推进 + 一键按标准记录'
};
