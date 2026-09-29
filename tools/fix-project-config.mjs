/**
 * 修复 project.config.json 的关键字段
 *
 * 背景：微信开发者工具在导入/改动设置时会重写这个文件，
 * 实测会丢掉 "miniprogramRoot"（本项目代码在 miniprogram/ 子目录），
 * 结果编译直接报：app.json: 在项目根目录未找到 app.json
 *
 * 本脚本只"补齐必需字段"，其余（appid、setting 等）原样保留。
 * 用法：node tools/fix-project-config.mjs        或 npm run fix:config
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = path.join(root, 'project.config.json');

// 必需字段（值必须完全一致）
const REQUIRED = {
  miniprogramRoot: 'miniprogram/',
  compileType: 'miniprogram'
};

if (!fs.existsSync(file)) {
  console.error('找不到 project.config.json —— 先在开发者工具里导入一次项目');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');
let cfg;
try {
  cfg = JSON.parse(raw);
} catch (e) {
  console.error('project.config.json 不是合法 JSON，请检查：', e.message);
  process.exit(1);
}

const changed = [];
for (const [k, v] of Object.entries(REQUIRED)) {
  if (cfg[k] !== v) {
    changed.push(`${k}: ${JSON.stringify(cfg[k])} → ${JSON.stringify(v)}`);
    cfg[k] = v;
  }
}

if (!changed.length) {
  console.log('✓ 必需字段都在，无需修复');
  console.log(`  miniprogramRoot = ${cfg.miniprogramRoot}`);
  console.log(`  appid           = ${cfg.appid || '(未设置)'}`);
  process.exit(0);
}

fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('✓ 已补齐字段：');
changed.forEach(c => console.log('  ' + c));
console.log(`  appid 保留为：${cfg.appid || '(未设置，请在开发者工具里填)'}`);
console.log('\n→ 回开发者工具：关闭该项目再重新打开（或重启工具），然后点「编译」');
