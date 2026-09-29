/**
 * 一条命令生成"真机预览码"
 *
 * 手机微信扫码即可在真机上打开小程序（比等发布/备案快得多）。
 * 前置条件：开发者工具已登录 + 设置 → 安全设置 → 服务端口 已开启。
 *
 * 用法：npm run qr
 * 产物：preview/preview-qr.jpg（预览码有时效，过期重跑一次即可）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callCli, usefulLines, preflight, findCli } from './lib/devtools.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'preview');
fs.mkdirSync(outDir, { recursive: true });

// CLI 输出的是 JPEG（即使文件名写 .png），这里直接用 .jpg
const qrFile = path.join(outDir, 'preview-qr.jpg');
fs.rmSync(qrFile, { force: true });

if (!findCli()) {
  console.error('没找到微信开发者工具 CLI，请设置环境变量 WECHAT_DEVTOOLS_CLI');
  process.exit(1);
}

const problems = preflight(root, path);
if (problems.length) {
  console.error('✗ 预检未通过：');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

console.log('→ 正在调用开发者工具编译并生成预览码…（首次可能要 30–60 秒）');
const { output } = callCli([
  'preview', '--project', root, '--qr-format', 'image', '--qr-output', qrFile, '--lang', 'zh'
]);
console.log(usefulLines(output, 14));

const total = output.match(/TOTAL[^']*'([\d.]+ KB)'/);
if (total) console.log(`\n编译体积：${total[1]}`);

if (fs.existsSync(qrFile)) {
  const kb = (fs.statSync(qrFile).size / 1024).toFixed(1);
  console.log(`\n✓ 预览码已生成：${path.relative(root, qrFile)}（${kb} KB）`);
  console.log('  手机微信扫码即可在真机上打开。预览码有时效，过期就重跑 npm run qr。');
} else {
  console.error('\n✗ 没有生成预览码。常见原因：');
  console.error('  1. 开发者工具没开「服务端口」：设置 → 安全设置 → 服务端口');
  console.error('  2. 没登录，或当前微信号不是该小程序的开发者');
  console.error('  3. project.config.json 配置被改坏 —— 先跑 npm run fix:config');
  process.exit(1);
}
