/**
 * 截图裁剪哈希（视觉回归基线用）—— 零依赖，自己解 PNG
 *
 * 为什么需要"裁剪"：微信开发者工具的截图里**带着模拟器状态栏，状态栏有实时时钟**
 * （12:19 这种）。实测同一状态前后隔一分钟截两张，**整文件哈希必然不同** ——
 * 拿整文件哈希当基线，每张图每次都会"变了"，等于没基线。
 * 实测结论（e2e 脚本跑出来的）：
 *   整文件哈希：不同 ✗
 *   裁掉顶部 40 行：相同 ✓（40 / 60 / 80 / 120 都稳定）
 * 所以默认裁掉顶部 CROP_TOP 行再哈希。**别把它当"忽略视觉变化"的后门** ——
 * 裁掉的只有状态栏那一条；页面内容全在哈希里。
 *
 * 为什么自己写解码器：项目运行时依赖是 0（这是刻意的选型，见 TESTING-REPORT）。
 * 只为算哈希引一个 sharp/jimp 进来不值得。DevTools 截图是 8bit / 非隔行 / 颜色类型 2(RGB)，
 * 所以只支持 0/2/4/6 这四种颜色类型就够了 —— 遇到不支持的格式**明确报错**，不静默算错。
 */
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const fs = require('node:fs');

/** 默认裁掉的行数：状态栏 + 标题栏上沿（实测 40 行就够，留 48 行余量） */
const CROP_TOP = 48;

const COLOR_CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * 解 PNG → { w, h, ch, rows }（rows 是已反过滤的像素行）
 * 只支持 8bit、非隔行、颜色类型 0/2/4/6。
 */
function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件');
  let pos = 8;
  let w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`只支持 8bit PNG，当前 ${depth}bit`);
  if (interlace !== 0) throw new Error('不支持隔行（Adam7）PNG');
  const ch = COLOR_CHANNELS[color];
  if (!ch) throw new Error(`不支持的颜色类型 ${color}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const rows = [];
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;       // 左
      const b = prev[x];                          // 上
      const c = x >= ch ? prev[x - ch] : 0;       // 左上
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      line[x] = v & 0xff;
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, ch, rows };
}

/**
 * 算"裁剪哈希"：跳过顶部 skipTop 行的像素，其余按顺序拼起来做 sha256。
 * ⚠️ 这个哈希**对 1 像素位移毫无容忍**（见下面 fingerprint 的说明），只适合当"完全没变"的快路径。
 * @param {string} file PNG 路径
 * @param {number} [skipTop] 默认 CROP_TOP
 * @returns {{hash:string,w:number,h:number,ch:number,skipTop:number,size:number}}
 */
function hashScreenshot(file, skipTop = CROP_TOP) {
  const buf = fs.readFileSync(file);
  const { w, h, ch, rows } = decodePng(buf);
  if (skipTop >= h) throw new Error(`裁剪行数 ${skipTop} 超过图片高度 ${h}`);
  return {
    hash: crypto.createHash('sha256').update(Buffer.concat(rows.slice(skipTop))).digest('hex').slice(0, 16),
    w, h, ch, skipTop,
    size: buf.length
  };
}

/**
 * 行暗度指纹：每一行"暗像素（亮度 < 200）的个数"，存成定长 hex。
 *
 * 为什么不用纯哈希（实测教训）：
 *   1) 状态栏有**实时时钟**和**电量百分比** —— 同一状态跨分钟截图，整文件哈希必变（裁剪掉顶部能解决）
 *   2) 重启开发者工具后，**整个页面渲染会整体位移约 1 像素** —— 实测导航栏标题字形
 *      "整体下移 1 行"，最大通道差 255。这种位移**裁剪解决不了**，纯哈希会报"全部 18 张都变了"（狼来了）
 * 行暗度指纹对 1px 位移几乎不敏感（黑像素只是在相邻行之间挪了一点），
 * 但对"少了一行字 / 多了一个块 / 颜色变了"很敏感 —— 所以用它做基线，用哈希做"完全一致"的快路径。
 */
function fingerprint(file, skipTop = CROP_TOP, darkThreshold = 200) {
  const buf = fs.readFileSync(file);
  const { w, h, ch, rows } = decodePng(buf);
  if (skipTop >= h) throw new Error(`裁剪行数 ${skipTop} 超过图片高度 ${h}`);
  const counts = [];
  for (let y = skipTop; y < h; y++) {
    const line = rows[y];
    let n = 0;
    for (let x = 0; x < w; x++) {
      const o = x * ch;
      // 亮度：整数近似（Rec.601），够用且快
      const lum = (299 * line[o] + 587 * line[o + 1] + 114 * line[o + 2]) / 1000;
      if (lum < darkThreshold) n++;
    }
    counts.push(Math.min(n, 255));
  }
  return {
    rows: Buffer.from(counts).toString('hex'),
    totalRows: counts.length,
    w, h, ch, skipTop, size: buf.length
  };
}

/**
 * 比对两个指纹，返回"差得离谱的行数"。
 * 1px 位移只会让少数行（字形/线稿边缘）的暗度变化几个像素；真正的内容改动会让成片行大幅变化。
 *
 * 阈值是**量出来的**（不是拍的）——用真实截图跑了 7 组对照：
 *   跨 IDE 会话（整体位移 1px，含大面积线稿的全屏大图）：3–4 行坏行 = 0.41%–0.54%
 *   同一页面换状态（详情页"有记录"vs"有草稿"，只差横幅一行字 + 几个标签）：12 行 = 1.63%
 *   完全不同的页面（首页 vs 列表）：403 行 = 54.7%
 * 所以取 0.8% 作为分界，两侧都有余量。
 * @param {number} [rowTolerance] 单行允许的暗像素差
 * @param {number} [ratioLimit] 允许的"坏行"占比
 * @param {number} [minBadRows] 坏行数下限（防止极矮的图靠比例误判）
 */
function diffFingerprint(aHex, bHex, rowTolerance = 8, ratioLimit = 0.008, minBadRows = 5) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return { comparable: false, reason: `行数不同（${a.length} vs ${b.length}）` };
  let bad = 0, worstRow = -1, worstDelta = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worstDelta) { worstDelta = d; worstRow = i; }
    if (d > rowTolerance) bad++;
  }
  const ratio = a.length ? bad / a.length : 0;
  return {
    comparable: true,
    badRows: bad,
    totalRows: a.length,
    ratio,
    worstRow,
    worstDelta,
    changed: bad >= minBadRows && ratio > ratioLimit
  };
}

module.exports = { decodePng, hashScreenshot, fingerprint, diffFingerprint, CROP_TOP };
