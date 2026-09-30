/**
 * 发布前卫生检查（分支 / 工作区 / 版本号一致性）
 *
 * 为什么要有：`npm run upload` 打的是**当前工作区**，不是某个 commit。
 * 于是很容易出现"传上去的包里混着没提交的改动"——出了问题在 git 里找不到对应版本。
 * 这个模块把"能不能上传"变成一组可复算的断言。
 *
 * 用法（作为 lib）：
 *   import { runReleaseChecks } from './lib/release-guard.mjs';
 *   const r = runReleaseChecks({ cwd });
 *   if (r.failures.length) process.exit(1);
 *
 * 用法（命令行）：npm run release:check
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const sh = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
};

/**
 * @param {object} o
 * @param {string} o.cwd      仓库根目录
 * @param {boolean} [o.forUpload] 上传场景：分支规则更严（必须是 main / prod）
 */
export function runReleaseChecks({ cwd, forUpload = false }) {
  const failures = [];
  const warnings = [];
  const info = [];

  // 1) 是不是 git 仓库
  const branch = sh(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch) {
    return { failures: ['当前目录不是 git 仓库（或 git 不可用）'], warnings, info };
  }
  info.push(`分支：${branch}`);

  // 2) 工作区必须干净：上传的包要能对应到一个 commit
  const dirty = sh(cwd, ['status', '--porcelain']);
  if (dirty) {
    const files = dirty.split('\n').slice(0, 8).join('\n      ');
    failures.push(`工作区不干净（有未提交改动），先提交再上传：\n      ${files}`);
  } else {
    info.push('工作区：干净');
  }

  // 3) build-info 的版本号必须与 package.json 一致（界面上的版本号就是验收凭据）
  let pkgVersion = '';
  let buildVersion = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
    pkgVersion = pkg.version;
    const b = fs.readFileSync(path.join(cwd, 'miniprogram', 'build-info.js'), 'utf8');
    buildVersion = (b.match(/version:\s*'([^']+)'/) || [])[1] || '';
    info.push(`版本号：package.json=${pkgVersion} ｜ 界面=${buildVersion}`);
  } catch (e) {
    failures.push(`读不到版本号：${e.message}`);
  }
  if (pkgVersion && buildVersion && pkgVersion !== buildVersion) {
    failures.push(`版本号不一致：package.json=${pkgVersion}，界面=${buildVersion}（跑 npm run stamp 会自动同步）`);
  }

  // 4) 分支规则：验收包从 main 出，提审包从 prod 出
  if (forUpload && branch !== 'main' && branch !== 'prod') {
    failures.push(`当前在 ${branch} 分支：上传只允许从 main（验收包）或 prod（提审包）发起`);
  }

  // 5) 提醒：还没推上去的提交，传上去的包在远端找不到
  const upstream = sh(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream) {
    const ahead = sh(cwd, ['rev-list', '--count', `${upstream}..HEAD`]);
    if (ahead && Number(ahead) > 0) {
      failures.push(`有 ${ahead} 个提交还没推送到 ${upstream}（先 push，再上传）`);
    } else {
      info.push(`与 ${upstream}：同步`);
    }
  } else {
    warnings.push('当前分支没有上游分支（没设 origin 跟踪），无法确认是否已推送');
  }

  // 6) 软提醒：版本号是否已经打过 tag（同一个版本号传两次会分不清）
  const tagsAtHead = sh(cwd, ['tag', '--points-at', 'HEAD']);
  if (branch === 'prod') {
    if (!tagsAtHead) warnings.push('prod 的 HEAD 上没有 tag（惯例是 tag/<yyMMdd>）');
    else info.push(`tag：${tagsAtHead.split('\n').join(' ')}`);
  }

  return { failures, warnings, info, branch, pkgVersion };
}

/** 打印检查结果，返回是否通过 */
export function report(result, log = console.log) {
  result.info.forEach(l => log(`  · ${l}`));
  result.warnings.forEach(l => log(`  ⚠ ${l}`));
  result.failures.forEach(l => log(`  ✗ ${l}`));
  return result.failures.length === 0;
}
