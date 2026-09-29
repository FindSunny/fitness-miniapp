/**
 * 更新构建标记（miniprogram/build-info.js 的 stamp）
 * 用法：npm run stamp
 *
 * 为什么需要：预览版/开发版很容易加载到旧包，界面上有个标记才能确认
 * "手机上跑的是不是我刚改的这版"。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = path.join(root, 'miniprogram', 'build-info.js');
const src = fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));

const today = new Date();
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const cur = (src.match(/stamp:\s*'([^']+)'/) || [])[1] || '';
const curDay = cur.split('.')[0];
const curNo = Number((cur.split('.')[1] || '0')) || 0;
const next = curDay === ymd ? `${ymd}.${curNo + 1}` : `${ymd}.1`;

let out = src.replace(/stamp:\s*'[^']+'/, `stamp: '${next}'`);
// 版本号只有一个来源：package.json。这里顺手同步，避免两处写着不同的号。
const curVer = (src.match(/version:\s*'([^']+)'/) || [])[1] || '';
if (curVer !== pkg.version) {
  out = out.replace(/version:\s*'[^']+'/, `version: '${pkg.version}'`);
  console.log(`version 同步: ${curVer || '(空)'} → ${pkg.version}（来自 package.json）`);
}
fs.writeFileSync(file, out, 'utf8');
console.log(`build stamp: ${cur || '(空)'} → ${next}`);
