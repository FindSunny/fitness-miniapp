/**
 * 上传开发版到微信后台
 *
 * 用法：
 *   npm run upload                # 用 package.json 里的版本号 + 默认描述
 *   npm run upload -- 0.2.0       # 指定版本号
 *   npm run upload -- 0.2.0 "描述文字"
 *
 * 上传后：mp.weixin.qq.com → 管理 → 版本管理 → 开发版本
 *   点「选为体验版」→ 生成体验版二维码 → 发给朋友（对方需先加为「体验成员」）
 *   （"选为体验版"目前只能在后台网页操作，CLI 没有对应参数）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callCli, usefulLines, preflight, findCli } from './lib/devtools.mjs';
import { runReleaseChecks, report } from './lib/release-guard.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// 去掉可能的 BOM（Windows 上被某些编辑器/PowerShell 写入过，会让 JSON.parse 直接抛错）
const pkgSrc = fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, '');
const pkg = JSON.parse(pkgSrc);

// 发布卫生检查：工作区干净 / 版本号一致 / 分支是 main 或 prod / 没有未推送的提交
// （急着传测试包：CF_SKIP_RELEASE_CHECK=1 npm run upload）
if (process.env.CF_SKIP_RELEASE_CHECK !== '1') {
  const check = runReleaseChecks({ cwd: root, forUpload: true });
  console.log('→ 发布前卫生检查');
  if (!report(check)) {
    console.error('\n✗ 卫生检查没通过（要跳过：CF_SKIP_RELEASE_CHECK=1 npm run upload）');
    process.exit(1);
  }
}

const version = (process.argv[2] || pkg.version || '').trim();
const desc = (process.argv[3] || `六艺十式 v${version} · 六艺 × 十式徒手训练晋级记录`).trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`版本号格式应为 x.y.z，当前是 ${JSON.stringify(version)}`);
  console.error('用法：npm run upload -- 0.1.0 "版本描述"');
  process.exit(1);
}

if (!findCli()) {
  console.error('没找到微信开发者工具 CLI，请设置环境变量 WECHAT_DEVTOOLS_CLI');
  process.exit(1);
}

const problems = preflight(root, path);
if (problems.length) {
  console.error('✗ 上传前自检未通过：');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log('✓ 上传前自检通过（配置 / 结构正常）');
console.log(`→ 正在上传 v${version}：${desc}`);

const { ok, output, error } = callCli([
  'upload', '--project', root, '--version', version, '--desc', desc, '--lang', 'zh'
], { timeout: 240000 });

if (error) console.error('调用 CLI 失败：', error.message);
console.log(usefulLines(output, 18));

if (!ok || !/upload\s*$/m.test(output) && !/√\s*upload/.test(output)) {
  console.error('\n✗ 上传可能失败。常见原因：');
  console.error('  1. 开发者工具没开「服务端口」：设置 → 安全设置');
  console.error('  2. 没登录，或当前微信号不是该小程序的开发者');
  console.error('  3. 配置被改坏 → 先跑 npm run fix:config');
  process.exit(1);
}

console.log(`\n✓ 已上传 v${version}`);
console.log('  下一步（只能网页操作）：');
console.log('  1. 打开 mp.weixin.qq.com → 管理 → 版本管理 → 开发版本');
console.log('  2. 找到刚上传的这一版，点「选为体验版」');
console.log('  3. 生成体验版二维码，发给朋友（对方需先被加为「体验成员」）');
