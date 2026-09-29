/**
 * 微信开发者工具 CLI 调用封装（预览码 / 上传共用）
 *
 * ⚠️ 踩坑记录（Windows）：
 *   cli.bat 必须经 shell 执行，但 Node 的 spawnSync(cli, args, { shell: true })
 *   在 "Program Files (x86)" 这种带空格的路径上会被 cmd 的引号规则解析坏，
 *   --project 的值会传错，工具报：
 *     "请检查 project.config.json 是否存在及是否有效 (code 19)"
 *   用 PowerShell 调用（& '路径' args...）与手动在终端执行等价，最稳。
 *
 * 前置条件：开发者工具已登录，且 设置 → 安全设置 → 服务端口 已开启。
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const CANDIDATES = [
  process.env.WECHAT_DEVTOOLS_CLI,
  'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat',
  'C:/Program Files/Tencent/微信web开发者工具/cli.bat',
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
].filter(Boolean);

export function findCli() {
  return CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

/** 调用 CLI，返回 { ok, output } */
export function callCli(args, { timeout = 180000 } = {}) {
  const cli = findCli();
  if (!cli) {
    return { ok: false, output: '没找到微信开发者工具 CLI，请用环境变量 WECHAT_DEVTOOLS_CLI 指定 cli.bat 路径' };
  }
  let res;
  if (process.platform === 'win32') {
    const ps = `& ${JSON.stringify(cli)} ${args.map(a => JSON.stringify(a)).join(' ')}`;
    res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout });
  } else {
    res = spawnSync(cli, args, { encoding: 'utf8', timeout });
  }
  const output = ((res.stdout || '') + (res.stderr || '')).trim();
  const ok = !res.error && res.status === 0 && !/Error:|错误|失败|TIMEOUT/.test(output);
  return { ok, output, error: res.error };
}

/** 从 CLI 输出里挑出有用的行（屏蔽长堆栈） */
export function usefulLines(output, limit = 14) {
  return output.split(/\r?\n/)
    .filter(l => l.trim())
    .filter(l => /app\.json|TOTAL|KB|AppID|preview|upload|错误|Error|失败|TIMEOUT|√|✗|Missing required/.test(l))
    .slice(-limit)
    .join('\n');
}

/** 上传前的项目自检：防止上传一个编译不了 / 配置被改坏的包 */
export function preflight(projectRoot, path) {
  const problems = [];
  const cfgPath = path.join(projectRoot, 'project.config.json');
  if (!fs.existsSync(cfgPath)) {
    problems.push('缺少 project.config.json（先在开发者工具里导入一次项目）');
    return problems;
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    problems.push('project.config.json 不是合法 JSON：' + e.message);
    return problems;
  }
  if (cfg.miniprogramRoot !== 'miniprogram/') {
    problems.push(`miniprogramRoot 应为 "miniprogram/"，当前是 ${JSON.stringify(cfg.miniprogramRoot)} → 跑 npm run fix:config`);
  }
  if (!/^wx[0-9a-f]{16}$/i.test(cfg.appid || '')) {
    problems.push(`appid 未设置或不合法（当前 ${JSON.stringify(cfg.appid)}）→ 跑 npm run set-appid -- wx...`);
  }
  if (!fs.existsSync(path.join(projectRoot, 'miniprogram', 'app.json'))) {
    problems.push('miniprogram/app.json 不存在，项目结构不对');
  }
  return problems;
}
