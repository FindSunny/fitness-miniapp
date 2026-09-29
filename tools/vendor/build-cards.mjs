// 囚徒健身 · 训练卡生成器
// 输出：A4 俯卧撑十式卡、A4 六艺速查卡、正方形俯卧撑卡、手机壁纸六艺速查
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../design/cards/');
fs.mkdirSync(OUT, { recursive: true });
const FONT = "'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif";

const C = {
  ink: '#111827', soft: '#334155', blue: '#2563eb', red: '#dc2626',
  gray: '#64748b', light: '#94a3b8', panel: '#f8fafc', border: '#e2e8f0',
  fill: '#eef2f7', wall: '#f1f5f9', white: '#ffffff'
};
const K = { // 暗色（手机壁纸）
  bg: '#0d1626', panel: '#152238', line: '#27395a', text: '#e8eefb',
  sub: '#93a7c6', accent: '#7cc4ff', dim: '#5f7a9e'
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = v => Math.round(v * 100) / 100;
const rad = d => d * Math.PI / 180;
const attrs = o => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '')
  .map(([k, v]) => `${k}="${typeof v === 'number' ? n(v) : v}"`).join(' ');

function T(x, y, s, o = {}) {
  const { size = 12, fill = C.ink, anchor = 'start', weight = 400, op, ls } = o;
  return `<text ${attrs({ x, y, 'font-size': size, fill, 'text-anchor': anchor, 'font-weight': weight, opacity: op, 'letter-spacing': ls })}>${esc(s)}</text>`;
}
// 按字符宽度粗暴折行（中英混排够用）
function wrapCN(str, max) {
  const out = []; let line = '', w = 0;
  for (const ch of str) {
    const cw = /[\x00-\xff]/.test(ch) ? 0.55 : 1;
    if (w + cw > max && line) { out.push(line); line = ''; w = 0; }
    line += ch; w += cw;
  }
  if (line) out.push(line);
  return out;
}

// ---------- 图元 ----------
const L = (a, b, o = {}) => ({ t: 'l', a, b, o: { w: 8, c: C.ink, ...o } });
const Ci = (c, r, o = {}) => ({ t: 'c', c, r, o: { fill: C.ink, ...o } });
const Pa = (pts, o = {}) => ({ t: 'p', pts, o: { closed: false, fill: 'none', stroke: C.ink, w: 8, ...o } });
const Bz = (pts, o = {}) => ({ t: 'b', pts, o: { fill: 'none', stroke: C.ink, w: 8, ...o } });
const Rc = (a, b, o = {}) => ({ t: 'r', a, b, o: { fill: 'none', ...o } });
const Tx = (p, s, o = {}) => ({ t: 't', p, s, o: { size: 9, fill: C.gray, anchor: 'middle', ...o } });

function bbox(parts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y, p = 0) => { x0 = Math.min(x0, x - p); y0 = Math.min(y0, y - p); x1 = Math.max(x1, x + p); y1 = Math.max(y1, y + p); };
  const walk = ps => {
    for (const p of ps) {
      if (p.t === 'l') { const w = (p.o.w || 0) / 2; add(p.a[0], p.a[1], w); add(p.b[0], p.b[1], w); }
      else if (p.t === 'c') add(p.c[0], p.c[1], (p.r || 0) + (p.o.w || 0) / 2);
      else if (p.t === 'p' || p.t === 'b') for (const q of p.pts) add(q[0], q[1], (p.o.w || 0) / 2);
      else if (p.t === 'r') { add(p.a[0], p.a[1]); add(p.b[0], p.b[1]); }
      else if (p.t === 't') add(p.p[0], p.p[1], p.o.size || 8);
    }
  };
  walk(parts);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function emit(parts, tf) {
  const X = x => tf.ox + (x - tf.minx) * tf.s;
  const Y = y => tf.oy + (tf.maxy - y) * tf.s;
  const out = [];
  for (const p of parts) {
    if (p.t === 'l') {
      out.push(`<line ${attrs({
        x1: X(p.a[0]), y1: Y(p.a[1]), x2: X(p.b[0]), y2: Y(p.b[1]),
        stroke: p.o.c, 'stroke-width': p.o.w * tf.s, 'stroke-linecap': p.o.cap || 'round',
        'stroke-dasharray': p.o.dash, opacity: p.o.op,
        'marker-start': p.o.mk ? `url(#ah-${p.o.mk})` : undefined,
        'marker-end': p.o.mk ? `url(#ah-${p.o.mk})` : undefined
      })}/>`);
    } else if (p.t === 'c') {
      out.push(`<circle ${attrs({ cx: X(p.c[0]), cy: Y(p.c[1]), r: p.r * tf.s, fill: p.o.fill, stroke: p.o.stroke, 'stroke-width': (p.o.w || 0) * tf.s, 'stroke-dasharray': p.o.dash, opacity: p.o.op })}/>`);
    } else if (p.t === 'p') {
      const d = p.pts.map((q, i) => `${i ? 'L' : 'M'}${n(X(q[0]))},${n(Y(q[1]))}`).join(' ') + (p.o.closed ? ' Z' : '');
      out.push(`<path ${attrs({ d, fill: p.o.fill, stroke: p.o.stroke, 'stroke-width': (p.o.w || 0) * tf.s, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': p.o.dash, opacity: p.o.op })}/>`);
    } else if (p.t === 'b') {
      const [a, c1, c2, b] = p.pts;
      const d = `M${n(X(a[0]))},${n(Y(a[1]))} C${n(X(c1[0]))},${n(Y(c1[1]))} ${n(X(c2[0]))},${n(Y(c2[1]))} ${n(X(b[0]))},${n(Y(b[1]))}`;
      out.push(`<path ${attrs({ d, fill: p.o.fill, stroke: p.o.stroke, 'stroke-width': (p.o.w || 0) * tf.s, 'stroke-linecap': 'round', opacity: p.o.op })}/>`);
    } else if (p.t === 'r') {
      out.push(`<rect ${attrs({ x: X(p.a[0]), y: Y(p.b[1]), width: (p.b[0] - p.a[0]) * tf.s, height: (p.b[1] - p.a[1]) * tf.s, fill: p.o.fill, stroke: p.o.stroke, 'stroke-width': (p.o.w || 0) * tf.s, rx: p.o.rx ? p.o.rx * tf.s : undefined, opacity: p.o.op })}/>`);
    } else if (p.t === 't') {
      out.push(T(X(p.p[0]), Y(p.p[1]), p.s, { ...p.o, size: (p.o.size || 9) * tf.s }));
    }
  }
  return out.join('\n');
}

// 把图形放进矩形框（自动缩放居中），extra 用局部坐标追加（不参与包围盒）
function place(parts, box, pad = 6, extra) {
  const b = bbox(parts);
  const s = Math.min((box.w - 2 * pad) / Math.max(b.w, 1), (box.h - 2 * pad) / Math.max(b.h, 1));
  const tf = { s, ox: box.x + (box.w - b.w * s) / 2, oy: box.y + (box.h - b.h * s) / 2, minx: b.x0, maxy: b.y1 };
  const ex = typeof extra === 'function' ? extra(b, tf) : (extra || []);
  return emit(parts.concat(ex), tf);
}

// ---------- 人体零件 ----------
function elbowPt(S, H, L1, L2, prefer = 'down') {
  const dx = H[0] - S[0], dy = H[1] - S[1], d = Math.max(Math.hypot(dx, dy), 0.001);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  const ux = dx / d, uy = dy / d;
  const e1 = [S[0] + ux * a - uy * h, S[1] + uy * a + ux * h];
  const e2 = [S[0] + ux * a + uy * h, S[1] + uy * a - ux * h];
  if (prefer === 'down') return e1[1] < e2[1] ? e1 : e2;
  return e1[1] > e2[1] ? e1 : e2;
}
function headAt(c, r, from, o = {}) {
  const parts = [Ci(c, r, { fill: C.white, stroke: C.ink, w: 5.5, ...o })];
  if (from) {
    const dx = c[0] - from[0], dy = c[1] - from[1], d = Math.hypot(dx, dy);
    parts.unshift(L(from, [c[0] - dx / d * r, c[1] - dy / d * r], { w: 8 }));
  }
  return parts;
}
function footAt(a, dir = 1) {
  const [x, y] = a;
  return Pa([[x - 8 * dir, y - 3], [x + 3 * dir, y - 3], [x + 13 * dir, 0], [x - 9 * dir, 0]], { closed: true, fill: C.ink, stroke: 'none' });
}
const floorLine = (b, tf) => [L([b.x0 - 8, 0], [b.x1 + 8, 0], { w: 1.8, c: C.light })];

// 俯卧撑：平板/俯身类姿势
function plank({ base, ang, sAt, len, hand, L1 = 30, L2 = 27, headR = 11, armW = 7, pref = 'down', foot = true }) {
  const dir = [Math.sin(rad(ang)), Math.cos(rad(ang))];
  const S = [base[0] + dir[0] * sAt, base[1] + dir[1] * sAt];
  const Hc = [base[0] + dir[0] * len, base[1] + dir[1] * len];
  const Hb = [Hc[0] - dir[0] * headR, Hc[1] - dir[1] * headR];
  const E = elbowPt(S, hand, L1, L2, pref);
  const parts = [
    L(base, Hb, { w: 9 }),
    L(S, E, { w: armW }), L(E, hand, { w: armW }),
    Ci(S, 3.4, { fill: C.ink }), Ci(E, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink }),
    ...headAt(Hc, headR, S)
  ];
  if (foot) parts.push(footAt(base, 1));
  return { parts, S, Hc, E };
}

// ---------- 俯卧撑十式 ----------
function figPushup(step) {
  switch (step) {
    case 1: { // 墙壁
      const f = plank({ base: [0, 8], ang: 31, sAt: 137, len: 157, hand: [108, 119], L1: 30, L2: 27 });
      const wall = [Rc([108, -10], [149, 166], { fill: C.wall }), Rc([108, -10], [149, 166], { fill: 'url(#hatch)' }), L([108, -10], [108, 166], { w: 2.4, c: C.soft })];
      return { parts: wall.concat(f.parts), extra: floorLine, tag: '侧视' };
    }
    case 2: { // 上斜
      const f = plank({ base: [0, 8], ang: 52, sAt: 137, len: 157, hand: [140, 70], L1: 30, L2: 27 });
      const bench = [
        Rc([138, 64], [216, 70], { fill: C.fill, stroke: C.soft, w: 1.6 }),
        L([146, 0], [146, 64], { w: 3.4, c: C.soft }), L([208, 0], [208, 64], { w: 3.4, c: C.soft }),
        L([138, 0], [138, 64], { w: 1.4, c: C.light }), L([216, 0], [216, 64], { w: 1.4, c: C.light })
      ];
      return { parts: bench.concat(f.parts), extra: floorLine, tag: '侧视' };
    }
    case 3: { // 膝盖
      const f = plank({ base: [0, 0], ang: 75, sAt: 95, len: 115, hand: [118, 0], L1: 30, L2: 27, foot: false });
      const leg = [
        L([0, 0], [-42, 3], { w: 9 }),
        Pa([[-42, 3], [-52, 11], [-50, 1], [-38, -1]], { closed: true, fill: C.ink, stroke: 'none' })
      ];
      return { parts: f.parts.concat(leg), extra: floorLine, tag: '侧视' };
    }
    case 4: { // 半俯卧撑
      const f = plank({ base: [0, 9], ang: 79.5, sAt: 137, len: 157, hand: [152, 0], L1: 30, L2: 27 });
      const mark = [
        L([112, 34], [112, 2], { w: 1.6, c: C.red, mk: 'red', cap: 'butt' }),
        Tx([104, 20], '半程', { size: 9, fill: C.red, anchor: 'end' })
      ];
      return { parts: f.parts, extra: (b, tf) => floorLine(b, tf).concat(mark), tag: '侧视' };
    }
    case 5: { // 标准
      const f = plank({ base: [0, 9], ang: 84, sAt: 137, len: 157, hand: [150, 0], L1: 26, L2: 20 });
      return { parts: f.parts, extra: floorLine, tag: '侧视' };
    }
    // ---- 以下为俯视（由上向下看），用来看手的位置 ----
    case 6: // 窄距
      return topFig({
        arms: [{ sh: [-21, 62], el: [-19, 52], hd: [-4, 44] }, { sh: [21, 62], el: [19, 52], hd: [4, 44] }],
        spread: 18,
        extra: [Pa([[-5, 44], [0, 48], [5, 44], [0, 40]], { closed: true, stroke: C.blue, w: 2.2, dash: '4 3' })]
      });
    case 7: // 偏重
      return topFig({
        arms: [{ sh: [-21, 62], el: [-33, 54], hd: [-24, 42] }, { sh: [21, 62], el: [33, 54], hd: [24, 50] }],
        ball: { c: [27, 50], r: 12 }, spread: 18, headX: -5
      });
    case 8: // 单臂半
      return topFig({
        arms: [{ sh: [21, 62], el: [27, 54], hd: [2, 44] }],
        behind: [-21, 62], spread: 32, headX: 2
      });
    case 9: // 杠杆
      return topFig({
        arms: [{ sh: [21, 62], el: [27, 54], hd: [2, 44] }, { sh: [-21, 62], el: [-40, 56], hd: [-57, 52] }],
        ball: { c: [-60, 52], r: 12 }, spread: 28, headX: 1
      });
    case 10: // 单臂
      return topFig({
        arms: [{ sh: [21, 62], el: [29, 55], hd: [0, 44] }],
        behind: [-21, 62], spread: 40, headX: 0
      });
  }
}
// 俯视用：按在地面上的手掌（掌 + 四指）
function handTop(p, ang = 90, r = 3.4) {
  const parts = [Ci(p, r, { fill: C.white, stroke: C.ink, w: 2.2 })];
  for (let i = -1.5; i <= 1.5; i++) {
    const a = rad(ang + i * 26);
    parts.push(L([p[0] + Math.cos(a) * r * 0.9, p[1] + Math.sin(a) * r * 0.9],
      [p[0] + Math.cos(a) * (r + 5.5), p[1] + Math.sin(a) * (r + 5.5)], { w: 2.2, c: C.ink }));
  }
  return parts;
}
function topFig({ arms, spread = 18, ball = null, behind = null, headX = 0, extra = [] }) {
  const SH = 21, HY = 62, HIP = 16, PY = 20, FY = -42;
  const parts = [
    Pa([[-SH, HY], [SH, HY], [HIP, PY], [-HIP, PY]], { closed: true, fill: C.fill, stroke: C.ink, w: 4 }),
    L([-HIP, PY], [-spread, FY], { w: 9 }), L([HIP, PY], [spread, FY], { w: 9 }),
    L([-spread - 7, FY], [-spread + 7, FY], { w: 6 }), L([spread - 7, FY], [spread + 7, FY], { w: 6 })
  ];
  if (behind) { parts.push(L(behind, [-16, 36], { w: 6.5, dash: '5 4' }), Ci([-16, 34], 4.2, { fill: C.ink })); }
  for (const a of arms) {
    parts.push(L(a.sh, a.el, { w: 7 }), L(a.el, a.hd, { w: 7 }), Ci(a.el, 3, { fill: C.ink }));
    parts.push(...handTop(a.hd, a.finger === undefined ? 90 : a.finger));
  }
  if (ball) parts.push(Ci(ball.c, ball.r, { fill: C.white, stroke: C.blue, w: 2.4, dash: '6 5' }));
  parts.push(...headAt([headX, 78], 12, [headX, 62]));
  parts.push(Tx([headX, 97], '头', { size: 8, fill: C.light }), Tx([0, FY - 12], '脚', { size: 8, fill: C.light }));
  return { parts: parts.concat(extra), extra: null, tag: '俯视（从上往下看）', top: true, ball };
}

// ---------- 六艺代表动作 ----------
function figSix(i) {
  if (i === 0) { // 俯卧撑（侧视 · 标准式底位）
    const f = plank({ base: [0, 9], ang: 84, sAt: 137, len: 157, hand: [150, 0], L1: 26, L2: 20 });
    return { parts: f.parts, extra: floorLine, tag: '' };
  }
  const k = i - 1;
  if (k === 0) { // 深蹲 · 单腿深蹲（侧视）
    const ankle = [0, 9], knee = [28, 38], hip = [14, 86], sh = [34, 130], hand = [84, 116];
    const fk = [58, 74], fa = [96, 66];
    return {
      parts: [
        footAt(ankle, 1),
        L(ankle, knee, { w: 9 }), L(knee, hip, { w: 10 }), L(hip, sh, { w: 10 }),
        L(sh, hand, { w: 7 }), Ci(hand, 4.6, { fill: C.ink }),
        L(hip, fk, { w: 9 }), L(fk, fa, { w: 9 }),
        Pa([[fa[0] - 5, fa[1] + 3], [fa[0] + 8, fa[1] + 8], [fa[0] + 10, fa[1] + 1], [fa[0] - 3, fa[1] - 3]], { closed: true, fill: C.ink, stroke: 'none' }),
        ...headAt([42, 148], 11, sh),
        Ci(knee, 3.2, { fill: C.ink }), Ci(hip, 3.2, { fill: C.ink })
      ], extra: floorLine, tag: ''
    };
  }
  if (k === 1) { // 引体向上（正视，下巴过杠）
    const parts = [
      L([-52, 150], [52, 150], { w: 6, c: C.soft }),
      L([-46, 150], [-46, 159], { w: 5, c: C.soft }), L([46, 150], [46, 159], { w: 5, c: C.soft }),
      L([-18, 150], [-40, 136], { w: 7 }), L([-40, 136], [-18, 120], { w: 7 }),
      L([18, 150], [40, 136], { w: 7 }), L([40, 136], [18, 120], { w: 7 }),
      Ci([-18, 150], 4.5, { fill: C.ink }), Ci([18, 150], 4.5, { fill: C.ink }),
      Pa([[-20, 120], [20, 120], [14, 74], [-14, 74]], { closed: true, fill: C.fill, stroke: C.ink, w: 4 }),
      L([-20, 120], [20, 120], { w: 8 }),
      L([-14, 74], [-15, 12], { w: 9 }), L([14, 74], [15, 12], { w: 9 }),
      Ci([-15, 10], 4, { fill: C.ink }), Ci([15, 10], 4, { fill: C.ink }),
      ...headAt([0, 164], 12, [0, 128])
    ];
    return { parts, tag: '' };
  }
  if (k === 2) { // 举腿（侧视，悬垂直举腿）
    const sh = [0, 112], hand = [-8, 168], hip = [-2, 64], knee = [17, 104], ankle = [43, 141];
    return {
      parts: [
        L([-46, 168], [46, 168], { w: 6, c: C.soft }),
        L([-40, 168], [-40, 177], { w: 5, c: C.soft }), L([40, 168], [40, 177], { w: 5, c: C.soft }),
        L(sh, hand, { w: 7 }), Ci(hand, 4.5, { fill: C.ink }),
        L(sh, hip, { w: 10 }),
        L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }),
        Pa([[ankle[0] - 6, ankle[1] + 1], [ankle[0] + 7, ankle[1] + 7], [ankle[0] + 10, ankle[1] - 1], [ankle[0] - 3, ankle[1] - 4]], { closed: true, fill: C.ink, stroke: 'none' }),
        Ci(hip, 3.2, { fill: C.ink }), Ci(knee, 3.2, { fill: C.ink }),
        ...headAt([9, 132], 11, sh)
      ], tag: ''
    };
  }
  if (k === 3) { // 桥（侧视，标准桥）
    const ankle = [0, 9], knee = [26, 50], hip = [6, 80], sh = [-36, 20], el = [-50, 40], hand = [-64, 8];
    return {
      parts: [
        footAt(ankle, 1),
        L(ankle, knee, { w: 9 }), L(knee, hip, { w: 10 }),
        Bz([hip, [-8, 64], [-30, 42], sh], { w: 10 }),
        L(sh, el, { w: 7 }), L(el, hand, { w: 7 }), Ci(hand, 4.5, { fill: C.ink }), Ci(el, 3, { fill: C.ink }),
        ...headAt([-54, 30], 11, sh)
      ], extra: floorLine, tag: ''
    };
  }
  // k===4 倒立撑（侧视，靠墙）
  const hand = [30, 0], sh = [26, 42], el = [9, 17], hip = [22, 90], knee = [14, 132], ankle = [10, 170];
  const wall = [Rc([-46, -12], [0, 186], { fill: C.wall }), Rc([-46, -12], [0, 186], { fill: 'url(#hatch)' }), L([0, -12], [0, 186], { w: 2.4, c: C.soft })];
  return {
    parts: wall.concat([
      L(sh, hip, { w: 10 }), L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }),
      Pa([[0, 176], [ankle[0] + 4, ankle[1] - 3], [ankle[0] - 1, ankle[1] - 9]], { closed: true, fill: C.ink, stroke: 'none' }),
      L(sh, el, { w: 7 }), L(el, hand, { w: 7 }), Ci(hand, 4.5, { fill: C.ink }), Ci(el, 3, { fill: C.ink }),
      ...headAt([46, 13], 11, sh)
    ]), extra: floorLine, tag: ''
  };
}

// ---------- 文案 ----------
const STEPS = [
  { name: '墙壁俯卧撑', cue: '手与肩同高、略宽于肩；头—肩—髋—踝一条直线，不塌腰不翘臀。', std: ['1 组 × 10', '2 组 × 25', '3 组 × 50'] },
  { name: '上斜俯卧撑', cue: '手撑桌沿或台阶，撑点越低越难；身体越平越吃力。', std: ['1 组 × 10', '2 组 × 20', '3 组 × 40'] },
  { name: '膝盖俯卧撑', cue: '膝着地，从膝到头顶一条直线；小腿贴地，别撅屁股。', std: ['1 组 × 10', '2 组 × 15', '3 组 × 30'] },
  { name: '半俯卧撑', cue: '撑地平板姿势，只下到一半（约一拳高），肘约 90°。', std: ['1 组 × 8', '2 组 × 12', '2 组 × 25'] },
  { name: '标准俯卧撑', cue: '手在肩下、略宽于肩；胸口轻触地面，全身绷紧如一块板。', std: ['1 组 × 5', '2 组 × 10', '2 组 × 20'] },
  { name: '窄距俯卧撑', cue: '双手并拢成菱形，肘贴身向后，不要外张。', std: ['1 组 × 5', '2 组 × 10', '2 组 × 20'] },
  { name: '偏重俯卧撑', cue: '一手撑球、一手撑地，重心压向地面那只手。', std: ['1 组 × 5', '2 组 × 10', '2 组 × 20 ★'] },
  { name: '单臂半俯卧撑', cue: '单臂半程，另一只手背后；双脚放宽保持稳定。', std: ['1 组 × 5', '2 组 × 10', '2 组 × 20 ★'] },
  { name: '杠杆俯卧撑', cue: '单臂为主，另一手伸直撑球做杠杆借力，逐步减力。', std: ['1 组 × 5', '2 组 × 10', '2 组 × 20 ★'] },
  { name: '单臂俯卧撑', cue: '单臂全幅度，另一手背后，双脚最宽；宁慢勿假。', std: ['每侧 1 组 × 5', '每侧 2 组 × 5', '每侧 2 组 × 10 ★'] }
];

const ARTS = [
  { name: '俯卧撑', en: 'Push-Up', cue: '手比肩略宽 · 肘贴身 · 全身一条直线',
    list: ['墙壁俯卧撑', '上斜俯卧撑', '膝盖俯卧撑', '半俯卧撑', '标准俯卧撑', '窄距俯卧撑', '偏重俯卧撑', '单臂半俯卧撑', '杠杆俯卧撑', '单臂俯卧撑'] },
  { name: '深蹲', en: 'Squat', cue: '脚跟不离地 · 膝随脚尖 · 髋坐到最低',
    list: ['肩倒立深蹲', '折刀深蹲', '支撑深蹲', '半深蹲', '标准深蹲', '窄距深蹲', '偏重深蹲', '单腿半深蹲', '单腿辅助深蹲', '单腿深蹲'] },
  { name: '引体向上', en: 'Pull-Up', cue: '沉肩挺胸 · 下巴过杠 · 不摆荡',
    list: ['垂直引体', '水平引体', '折刀引体', '半引体', '标准引体', '窄距引体', '偏重引体', '单臂半引体', '单臂辅助引体', '单臂引体'] },
  { name: '举腿', en: 'Leg Raise', cue: '腹部发力 · 不借摆 · 腰背贴紧',
    list: ['坐姿屈膝', '平卧抬膝', '平卧屈举腿', '平卧蛙举腿', '平卧直举腿', '悬垂屈膝', '悬垂屈举腿', '悬垂蛙举腿', '悬垂半举腿', '悬垂直举腿'] },
  { name: '桥', en: 'Bridge', cue: '肩背先落 · 臀部顶起 · 脊柱逐节展开',
    list: ['短桥', '直桥', '高低桥', '顶桥', '半桥', '标准桥', '下行桥', '上行桥', '合桥', '铁板桥'] },
  { name: '倒立撑', en: 'Handstand Push-Up', cue: '从靠墙开始 · 肘贴身 · 头顶成三角',
    list: ['顶墙倒立', '乌鸦式', '靠墙倒立', '半倒立撑', '标准倒立撑', '窄距倒立撑', '偏重倒立撑', '单臂半倒立撑', '杠杆倒立撑', '单臂倒立撑'] }
];

// ---------- 文档骨架 ----------
function defs(dark) {
  const h = dark ? '#3b5480' : '#b9c6d6';
  return `<defs>
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="${h}" stroke-width="1.7"/>
    </pattern>
    ${['red', 'blue', 'ink'].map((k, i) => {
      const col = [C.red, C.blue, C.ink][i];
      return `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${col}"/></marker>`;
    }).join('\n')}
  </defs>`;
}
function doc({ w, h, bg = '#ffffff', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
${defs(bg !== '#ffffff')}
<rect width="${w}" height="${h}" fill="${bg}"/>
${body}
</svg>`;
}

// ---------- 俯卧撑单元格 ----------
function pushupCell(x, y, w, h, step, dark = false) {
  const t = STEPS[step - 1];
  const g = [`<rect ${attrs({ x, y, width: w, height: h, rx: 10, fill: dark ? '#0d1626' : C.panel, stroke: dark ? '#27395a' : C.border, 'stroke-width': 1 })}/>`];
  const figW = w * 0.48;
  const fig = figPushup(step);
  g.push(place(fig.parts, { x: x + 8, y: y + 10, w: figW, h: h - 20 }, 5, fig.extra));
  const tx = x + figW + 16;
  const cw = w - figW - 26;
  g.push(T(tx, y + 24, `第 ${step} 式`, { size: 11, fill: C.light }));
  g.push(T(tx + 52, y + 24, fig.tag, { size: 10, fill: C.blue }));
  g.push(T(tx, y + 44, t.name, { size: 17, weight: 700 }));
  let ly = y + 62;
  for (const line of wrapCN(t.cue, Math.floor(cw / 11.5))) { g.push(T(tx, ly, line, { size: 11, fill: C.gray })); ly += 15; }
  ly += 4;
  const tags = ['初级', '中级', '升级'];
  for (let i = 0; i < 3; i++) {
    g.push(T(tx, ly, tags[i], { size: 11, fill: C.light }));
    g.push(T(tx + 36, ly, t.std[i], { size: 11.5, fill: C.ink, weight: 600 }));
    ly += 16;
  }
  return g.join('\n');
}

// ---------- 1) A4 俯卧撑十式 ----------
function a4Pushups() {
  const W = 794, H = 1123;
  const body = [];
  body.push(T(42, 62, '囚徒健身 · 俯卧撑十式', { size: 26, weight: 700 }));
  body.push(T(42, 88, '从墙壁到单臂，一式一关；达到「升级标准」再进下一式　节奏 2-1-2：2 秒下 · 停 1 秒 · 2 秒上', { size: 12, fill: C.gray }));
  body.push(L([42, 102], [752, 102], { w: 2, c: C.border }));
  const top = 118, rows = 5, cols = 2;
  const gap = 12;
  const cw = (752 - 42 - gap) / cols, ch = (1080 - top - (rows - 1) * gap) / rows;
  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    body.push(pushupCell(42 + c * (cw + gap), top + r * (ch + gap), cw, ch, i + 1));
  }
  body.push(T(42, 1100, '数字按中译本常见标准整理，★ 为每侧计数；各版本记载略有差异，仅供参考。示意图为本卡自绘，非书中原图。', { size: 10, fill: C.light }));
  return doc({ w: W, h: H, body: body.join('\n') });
}

// ---------- 2) A4 六艺速查 ----------
function a4Six() {
  const W = 794, H = 1123;
  const body = [];
  body.push(T(42, 62, '囚徒健身 · 六艺十式速查', { size: 26, weight: 700 }));
  body.push(T(42, 88, '六艺 = 俯卧撑 · 深蹲 · 引体向上 · 举腿 · 桥 · 倒立撑　｜　每艺 10 式，共 60 式，由易到难循序通关', { size: 12, fill: C.gray }));
  body.push(L([42, 102], [752, 102], { w: 2, c: C.border }));
  const top = 118, rows = 6, gap = 10;
  const ch = (1078 - top - (rows - 1) * gap) / rows;
  for (let i = 0; i < 6; i++) {
    const y = top + i * (ch + gap);
    body.push(`<rect ${attrs({ x: 42, y, width: 710, height: ch, rx: 10, fill: C.panel, stroke: C.border, 'stroke-width': 1 })}/>`);
    const fig = figSix(i);
    body.push(place(fig.parts, { x: 52, y: y + 8, w: 210, h: ch - 16 }, 4, fig.extra));
    body.push(T(276, y + 40, `${i + 1}. ${ARTS[i].name}`, { size: 17, weight: 700 }));
    body.push(T(276 + 96, y + 40, ARTS[i].en, { size: 11, fill: C.light }));
    body.push(T(276, y + 58, ARTS[i].cue, { size: 11, fill: C.gray }));
    for (let k = 0; k < 10; k++) {
      const col = k < 5 ? 0 : 1, row = k % 5;
      const bx = 276 + col * 224, by = y + 78 + row * 16;
      body.push(T(bx, by, `${k + 1}`, { size: 10, fill: C.blue, weight: 600 }));
      body.push(T(bx + 16, by, ARTS[i].list[k], { size: 11, fill: C.soft }));
    }
  }
  body.push(T(42, 1100, '训练安排：每周 2–3 次，每次挑 3 艺轮换（推 / 拉 / 腿 各一，再补桥与举腿）；每式 2–3 组，组间休息 1–2 分钟。', { size: 10, fill: C.light }));
  return doc({ w: W, h: H, body: body.join('\n') });
}

// ---------- 3) 正方形（1080×1080）俯卧撑十式 ----------
function squarePushups() {
  const W = 1080, H = 1080;
  const body = [];
  body.push(T(40, 56, '囚徒健身 · 俯卧撑十式', { size: 32, weight: 700 }));
  body.push(T(40, 82, '达到升级标准再进下一式　｜　节奏 2-1-2', { size: 15, fill: C.gray }));
  body.push(L([40, 96], [1040, 96], { w: 2, c: C.border }));
  const top = 108, gap = 12, cols = 2, rows = 5;
  const cw = (1040 - 40 - gap) / cols, ch = (1040 - top - (rows - 1) * gap) / rows;
  for (let i = 0; i < 10; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    body.push(pushupCell(40 + c * (cw + gap), top + r * (ch + gap), cw, ch, i + 1));
  }
  body.push(T(40, 1066, '数字按中译本常见标准整理，★ 为每侧计数；示意图自绘，非书中原图。', { size: 12, fill: C.light }));
  return doc({ w: W, h: H, body: body.join('\n') });
}

// ---------- 4) 手机壁纸（1080×2340，暗色）六艺速查 ----------
function phoneSix() {
  const W = 1080, H = 2340;
  const body = [];
  body.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#tgrad)"/>`);
  body.push(T(70, 300, 'CONVICT CONDITIONING', { size: 20, fill: K.accent, ls: 3 }));
  body.push(T(70, 366, '六艺十式 · 速查', { size: 54, weight: 700, fill: K.text }));
  body.push(T(70, 412, '俯卧撑 · 深蹲 · 引体向上 · 举腿 · 桥 · 倒立撑', { size: 22, fill: K.sub }));
  const top = 460, gap = 16, rows = 6;
  const ch = (2210 - top - (rows - 1) * gap) / rows; // ≈ 275
  for (let i = 0; i < 6; i++) {
    const y = top + i * (ch + gap);
    body.push(`<rect ${attrs({ x: 70, y, width: 940, height: ch, rx: 22, fill: K.panel, stroke: K.line, 'stroke-width': 1.5, opacity: 0.96 })}/>`);
    body.push(`<rect ${attrs({ x: 70, y: y + 26, width: 7, height: ch - 52, rx: 3.5, fill: K.accent, opacity: 0.85 })}/>`);
    body.push(T(112, y + 62, ARTS[i].name, { size: 36, weight: 700, fill: K.text }));
    body.push(T(112 + (ARTS[i].name.length * 36 + 18), y + 62, ARTS[i].en, { size: 18, fill: K.dim }));
    body.push(T(112, y + 96, ARTS[i].cue, { size: 19, fill: K.sub }));
    for (let k = 0; k < 10; k++) {
      const col = k < 5 ? 0 : 1, row = k % 5;
      const bx = 112 + col * 450, by = y + 140 + row * 27;
      body.push(T(bx, by, `${k + 1}`, { size: 20, fill: K.accent, weight: 700 }));
      body.push(T(bx + 30, by, ARTS[i].list[k], { size: 22, fill: K.text }));
    }
  }
  body.push(T(540, 2290, '每周 2–3 次 · 每次 3 艺轮换 · 组间 1–2 分钟 · 节奏 2-1-2', { size: 21, fill: K.sub, anchor: 'middle' }));
  const defsExtra = `<linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#101d33"/><stop offset="0.5" stop-color="#0d1626"/><stop offset="1" stop-color="#0a1220"/></linearGradient>`;
  return doc({ w: W, h: H, bg: K.bg, body: body.join('\n') }).replace('</defs>', defsExtra + '</defs>');
}

// ---------- 输出 ----------
// 只有直接运行本文件时才写卡片；被 import（如 export-figures.mjs）时不动磁盘。
const RUN_AS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (RUN_AS_MAIN) {
  const files = {
    'cc-pushups-a4.svg': a4Pushups(),
    'cc-six-a4.svg': a4Six(),
    'cc-pushups-square.svg': squarePushups(),
    'cc-six-phone.svg': phoneSix()
  };
  for (const [f, s] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, f), s, 'utf8');
    console.log(`${f}  ${(s.length / 1024).toFixed(1)} KB`);
  }
  console.log(`卡片已写入：${OUT}`);
}

// 供其它脚本复用（例如 fitness-miniapp 导出小程序用的动作图）
// 供其它脚本复用（例如 fitness-miniapp 导出小程序用的动作图 / 各艺的示意图模块）
// Bz / Tx 是贝塞尔与文字；elbowPt / headAt / footAt / floorLine / plank / topFig / handTop
// 是画人体用的零件与姿势生成器 —— 新增"其它五艺"的示意图时直接复用这些，别重画一遍
export {
  defs, place, figPushup, figSix, emit, bbox, T, C, K, L, Ci, Pa, Rc, Bz, Tx,
  elbowPt, headAt, footAt, floorLine, plank, topFig, handTop, rad, n
};
