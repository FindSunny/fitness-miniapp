/**
 * 小程序包体积体检：主包上限 2MB，超过就要分包
 * 用法：node tools/size-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = path.join(root, 'miniprogram');
const LIMIT = 2 * 1024 * 1024; // 主包 2MB

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push({ rel: path.relative(dir, p).replace(/\\/g, '/'), size: fs.statSync(p).size });
  }
})(dir);

const byExt = {};
for (const f of files) {
  const ext = (path.extname(f.rel) || '(无)').toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + f.size;
}
const total = files.reduce((s, f) => s + f.size, 0);
const kb = n => (n / 1024).toFixed(1) + ' KB';

console.log(`主包大小：${kb(total)} / ${kb(LIMIT)}  （${((total / LIMIT) * 100).toFixed(1)}%）`);
console.log('');
console.log('按类型：');
Object.entries(byExt).sort((a, b) => b[1] - a[1])
  .forEach(([ext, size]) => console.log(`  ${ext.padEnd(8)} ${kb(size).padStart(12)}  ${files.filter(f => (path.extname(f.rel) || '(无)').toLowerCase() === ext).length} 个`));

console.log('');
console.log('最大的 5 个文件：');
files.sort((a, b) => b.size - a.size).slice(0, 5)
  .forEach(f => console.log(`  ${kb(f.size).padStart(12)}  ${f.rel}`));

if (total > LIMIT) {
  console.error('\n✗ 已超过主包上限，需要分包（把 assets 放进 subpackage）');
  process.exit(1);
}
console.log('\n✓ 体积正常');
