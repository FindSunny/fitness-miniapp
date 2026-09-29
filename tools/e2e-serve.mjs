/**
 * 启动小程序自动化服务（供 e2e 使用）
 *
 * 就是执行 `cli auto --project <本项目> --auto-port 9420`。
 * 单独做成脚本的原因：
 *   1. 终端里手敲需要 `&` 调用符（PowerShell 的坑），容易报
 *      "Unexpected token 'auto' in expression or statement"
 *   2. 自动化窗口被 e2e 收尾关闭后，需要重新拉起
 *
 * 用法：npm run e2e:serve       （看到 √ auto 即可）
 *      然后另开一个终端跑：npm run e2e
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callCli, usefulLines, findCli } from './lib/devtools.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

if (!findCli()) {
  console.error('没找到微信开发者工具 CLI，请设置环境变量 WECHAT_DEVTOOLS_CLI');
  process.exit(1);
}

console.log('→ 正在启动自动化服务（cli auto --auto-port 9420）…');
const { output } = callCli(['auto', '--project', root, '--auto-port', '9420', '--lang', 'zh'], { timeout: 180000 });
console.log(usefulLines(output, 12));

if (/√\s*auto/.test(output) || /auto\s*$/m.test(output)) {
  console.log('\n✓ 自动化服务已启动，窗口会保持打开。');
  console.log('  下一步：另开终端运行 npm run e2e');
} else {
  console.error('\n✗ 启动失败。请确认：');
  console.error('  1. 开发者工具已登录，且当前微信号是该小程序的开发者');
  console.error('  2. 设置 → 安全设置 → 服务端口 已开启');
  console.error('  3. 若工具里这个项目已在运行，先关掉项目窗口再试');
  process.exit(1);
}
