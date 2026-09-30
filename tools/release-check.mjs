/**
 * 发布前卫生检查（命令行）
 *
 *   npm run release:check
 *
 * 检查四件事：
 *   1. 工作区干净（上传的包要能对应到一个 commit）
 *   2. package.json 与界面上的版本号一致
 *   3. 当前分支是 main（验收包）或 prod（提审包）
 *   4. 没有未推送的提交
 *
 * 退出码非 0 = 不该上传。`npm run upload` 里也会跑同一套检查
 * （急着传个测试包时可以 `CF_SKIP_RELEASE_CHECK=1 npm run upload`）。
 */
import { fileURLToPath } from 'node:url';
import { runReleaseChecks, report } from './lib/release-guard.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

console.log('→ 发布前卫生检查');
const result = runReleaseChecks({ cwd: root, forUpload: true });
const ok = report(result);

if (!ok) {
  console.log('\n✗ 没通过，先修上面这几条再上传。');
  process.exit(1);
}
console.log('\n✓ 通过：可以从这个分支上传了。');
if (result.branch === 'main') {
  console.log('  提示：main 出的是**验收包**（给真机验收用）；提审/发布请从 prod 出。');
}
