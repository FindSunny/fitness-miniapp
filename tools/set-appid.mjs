/**
 * 一键写入 AppID（省得在开发者工具导入弹窗里改）
 *
 * 用法：node tools/set-appid.mjs wx1234567890abcdef
 *     或：npm run set-appid -- wx1234567890abcdef
 *
 * 为什么要这样做：project.config.json 里若留着 "touristappid"，
 * 开发者工具会按"游客模式"处理（预览/上传等能力被禁用，导入弹窗也不让你改）。
 * 这里直接把真实 AppID 写进配置，导入后就是正常项目。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = path.join(root, 'project.config.json');
const appid = (process.argv[2] || '').trim();

if (!appid) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('当前 project.config.json 里的 appid：', cfg.appid || '(未设置)');
  console.log('用法：node tools/set-appid.mjs wx1234567890abcdef');
  process.exit(0);
}

if (!/^wx[0-9a-f]{16}$/i.test(appid)) {
  console.error(`AppID 格式不对：${appid}`);
  console.error('应该是 wx + 16 位十六进制，例如 wx1a2b3c4d5e6f7a8b');
  console.error('（在 mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 里能看到）');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
cfg.appid = appid;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log(`✓ 已写入 AppID：${appid}`);
console.log('  → 回开发者工具重新导入项目（或关闭当前项目再打开）即可生效');
