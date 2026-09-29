/**
 * 引体向上十式 · 火柴人示意图
 *
 * 约定（与 tools/vendor/figures/_contact.mjs 对齐）：
 *   figPullup(no) → { parts, extra, tag }，no = 1..10
 *   局部坐标：y 向上，地面 y = 0；图形大致以 x = 0 为中心
 *
 * 十式共用同一套骨架，所以比例天然一致：
 *   头 r 11 · 肩半宽 19 · 髋半宽 13 · 肩→头心 36 · 肩→髋 56 · 髋→踝 78
 * 并且每式的包围盒高度都压在 ~190（floorLine 之类 extra 不参与包围盒），
 * 这样 _contact.mjs 里 place() 对每格的缩放几乎相同（0.98~0.99），十张图一样大。
 *
 * 画法沿用 build-cards.mjs 的零件：elbowPt / headAt / footAt / plank / floorLine，
 * 只在"脚要踩在凳子/台阶上"时补了一个 footOn()（就是 footAt 的形状整体抬到某个高度）。
 */
import { C, L, Ci, Pa, Rc, Tx, elbowPt, headAt, footAt, floorLine, plank } from '../build-cards.mjs';

const HR = 11;                 // 头半径
const A1 = 29, A2 = 27;        // 上臂 / 前臂
const SHW = 19, HPW = 13;      // 肩半宽 / 髋半宽
const TOR = 56, LEG = 78;      // 肩→髋 / 髋→踝
const HEAD_UP = 36;            // 肩→头心（略短于 figSix 的长脖子，更接近真人）
const AW = 7, LW = 9, TW = 10; // 手臂 / 腿 / 躯干 线宽

// 踩在指定高度上的脚（soleY = 0 时就是 footAt 本体）
function footOn(ankle, dir = 1, soleY = 0) {
  if (!soleY) return footAt(ankle, dir);
  const [x] = ankle;
  return Pa([[x - 8 * dir, soleY + 5], [x + 3 * dir, soleY + 5], [x + 13 * dir, soleY], [x - 9 * dir, soleY]],
    { closed: true, fill: C.ink, stroke: 'none' });
}
// 悬垂时朝下的脚尖（正视：正面看到的小楔形）
function toeDown(a, dir = 1) {
  const [x, y] = a;
  return Pa([[x - 5 * dir, y + 3], [x + 5 * dir, y + 3], [x + 2 * dir, y - 11], [x - 3 * dir, y - 11]],
    { closed: true, fill: C.ink, stroke: 'none' });
}
// 手绘虚线：stroke-dasharray 不随 place() 缩放、会跟线宽打架，这里自己切段，任何缩放下都像虚线
function dashLine(a, b, o = {}) {
  const seg = o.seg || 10, gap = o.gap || 8, w = o.w || 6, c = o.c || C.ink;
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d, out = [];
  for (let t = 0; t < d - 0.5; t += seg + gap) {
    const e = Math.min(t + seg, d);
    out.push(L([a[0] + ux * t, a[1] + uy * t], [a[0] + ux * e, a[1] + uy * e], { w, c, cap: 'butt' }));
  }
  return out;
}
// 单杠：横杠 + 两端向上的短柱（跟 figSix 里的杠画法一致）
function barAt(x0, x1, y) {
  return [
    L([x0, y], [x1, y], { w: 6, c: C.soft }),
    L([x0 + 7, y], [x0 + 7, y + 12], { w: 5, c: C.soft }),
    L([x1 - 7, y], [x1 - 7, y + 12], { w: 5, c: C.soft })
  ];
}
// 手臂：肩 → 肘（IK）→ 手
function arm(S, H, prefer = 'down') {
  const E = elbowPt(S, H, A1, A2, prefer);
  return [L(S, E, { w: AW }), L(E, H, { w: AW }), Ci(E, 3, { fill: C.ink }), Ci(H, 4.6, { fill: C.ink })];
}
// 正视人体：肩线/躯干 + 两条腿 + 头（手臂各步自己接，因为要抓杠/抓腕/抓毛巾）
function bodyFront(o = {}) {
  const {
    sx = 0, sy, hx = sx, hy = sy - TOR,
    headX = sx, headY = sy + HEAD_UP, headR = HR,
    ankX = 14, ankY = hy - LEG, sole = null, dir = 1
  } = o;
  const parts = [
    Pa([[sx - SHW, sy], [sx + SHW, sy], [hx + HPW, hy], [hx - HPW, hy]], { closed: true, fill: C.fill, stroke: C.ink, w: 4 }),
    L([sx - SHW, sy], [sx + SHW, sy], { w: 8 })
  ];
  for (const s of [-1, 1]) {
    const hip = [hx + s * HPW, hy];
    const ank = [hx + s * ankX, ankY];
    const knee = [(hip[0] + ank[0]) / 2, (hy + ankY) / 2];
    parts.push(L(hip, knee, { w: LW }), L(knee, ank, { w: LW }), Ci(knee, 3, { fill: C.ink }));
    parts.push(sole === null ? toeDown(ank, s) : footOn(ank, s * dir, sole));
  }
  parts.push(...headAt([headX, headY], headR, [sx, sy]));
  return { parts, SL: [sx - SHW, sy], SR: [sx + SHW, sy] };
}

export function figPullup(no) {
  switch (no) {
    // 1 垂直引体：站在门框边，双手抓框、身体后倾，靠手臂把身体拉向门框（脚不离地）
    case 1: {
      const frame = [
        Rc([0, 0], [34, 190], { fill: C.wall }),
        Rc([0, 0], [34, 190], { fill: 'url(#hatch)' }),
        L([0, 0], [0, 190], { w: 2.4, c: C.soft })
      ];
      const sh = [-30, 138], hip = [-47, 84], knee = [-40, 46], ank = [-33, 8], head = [-41, 172];
      const hand = [0, 132], el = elbowPt(sh, hand, A1, A2, 'down');
      const parts = frame.concat([
        L(hip, knee, { w: LW }), L(knee, ank, { w: LW }), Ci(knee, 3, { fill: C.ink }),
        footOn(ank, 1, 0),
        L(hip, sh, { w: TW }), Ci(hip, 3.2, { fill: C.ink }),
        L(sh, el, { w: AW }), L(el, hand, { w: AW }), Ci(el, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink }),
        ...headAt(head, HR, sh)
      ]);
      return {
        parts,
        extra: (b, tf) => floorLine(b, tf).concat([
          L([-78, 92], [-44, 120], { w: 1.8, c: C.red, mk: 'red', cap: 'butt' }),
          Tx([-84, 112], '拉向门框', { size: 9, fill: C.red, anchor: 'end' })
        ]),
        tag: '侧视'
      };
    }

    // 2 水平引体：低杠（架子里）下方，脚跟着地，把胸口拉向杠 —— 斜身划船
    case 2: {
      const bar = [
        L([-12, 0], [-12, 190], { w: 5, c: C.soft }),
        L([186, 0], [186, 190], { w: 5, c: C.soft }),
        L([-12, 90], [186, 90], { w: 6, c: C.soft })
      ];
      const f = plank({
        base: [0, 9], ang: 70, sAt: 138, len: 174,
        hand: [124, 90], L1: A1, L2: A2, headR: HR, armW: AW, pref: 'down'
      });
      return { parts: bar.concat(f.parts), extra: floorLine, tag: '侧视' };
    }

    // 3 折刀引体：单杠 + 双脚踩凳、身体折刀式，上半身拉起（下巴到杠）
    case 3: {
      const bar = barAt(-46, 46, 166);
      const bench = [
        Rc([46, 0], [102, 52], { fill: C.fill, stroke: C.soft, w: 1.6 }),
        Rc([46, 0], [102, 52], { fill: 'url(#hatch)' })
      ];
      const sh = [0, 142], hip = [0, 86], head = [0, 178];
      const ank = [73.5, 60], knee = [36.8, 73];
      const hand = [10, 166], el = elbowPt(sh, hand, A1, A2, 'down'); // 肘朝身体前方（远离凳）
      const parts = bench.concat(bar, [
        L(hip, knee, { w: LW }), L(knee, ank, { w: LW }), Ci(knee, 3, { fill: C.ink }),
        footOn(ank, 1, 52),
        L(hip, sh, { w: TW }), Ci(hip, 3.2, { fill: C.ink }),
        L(sh, el, { w: AW }), L(el, hand, { w: AW }), Ci(el, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink }),
        ...headAt(head, HR, sh)
      ]);
      return { parts, extra: floorLine, tag: '侧视' };
    }

    // 4 半引体：肘约 90°、只拉一半，脚下踩地借一点力（红线标出还差半程）
    case 4: {
      const bar = barAt(-52, 52, 178);
      const B = bodyFront({ sx: 0, sy: 142, hx: 0, hy: 86, ankX: 14, ankY: 8, sole: 0, headY: 165 });
      const parts = bar.concat(B.parts, arm(B.SR, [30, 178]), arm(B.SL, [-30, 178]));
      const mark = [
        L([-58, 152], [-58, 182], { w: 1.6, c: C.red, mk: 'red', cap: 'butt' }),
        Tx([-64, 170], '半程', { size: 9, fill: C.red, anchor: 'end' })
      ];
      return { parts, extra: (b, tf) => floorLine(b, tf).concat(mark), tag: '正视' };
    }

    // 5 标准引体：正手握杠（略宽于肩）、全幅度、下巴过杠，悬空
    case 5: {
      const bar = barAt(-58, 58, 166);
      const B = bodyFront({ sy: 142, hy: 86, headY: 179 });
      const parts = bar.concat(B.parts, arm(B.SR, [30, 166]), arm(B.SL, [-30, 166]));
      return { parts, tag: '正视' };
    }

    // 6 窄距引体：双手并拢（约与头同宽）拉到下巴过杠
    case 6: {
      const bar = barAt(-58, 58, 164);
      const B = bodyFront({ sy: 140, hy: 84, headY: 177 });
      const parts = bar.concat(B.parts, arm(B.SR, [11, 164], 'up'), arm(B.SL, [-11, 164], 'up'));
      return { parts, tag: '正视' };
    }

    // 7 偏重引体：右手为主拉（抓杠），左手抓住右前臂借力；两手指向清楚分开
    case 7: {
      const bar = barAt(-58, 58, 166);
      const B = bodyFront({ sy: 142, hx: 2, hy: 86, headY: 179 });
      const H = [20, 166];
      const E = elbowPt(B.SR, H, A1, A2, 'down');
      const grip = [E[0] + (H[0] - E[0]) * 0.5, E[1] + (H[1] - E[1]) * 0.5]; // 右前臂中点
      const parts = bar.concat(B.parts, [
        L(B.SR, E, { w: AW }), L(E, H, { w: AW }), Ci(E, 3, { fill: C.ink }), Ci(H, 4.6, { fill: C.ink })
      ], arm(B.SL, grip, 'down'), [
        // 辅助手画成"握"的样子：一圈白底描边的拳头套在对方前臂上
        Ci(grip, 5.4, { fill: C.white, stroke: C.ink, w: 3 }),
        Tx([46, 140], '抓前臂', { size: 9, fill: C.light })
      ]);
      return { parts, tag: '正视' };
    }

    // 8 单臂半引体：单手握杠、只拉到一半（肘约 90°），另一只手自然垂放
    case 8: {
      const bar = barAt(-58, 58, 168);
      const B = bodyFront({ sx: 4, sy: 132, hx: 6, hy: 76, ankX: 14, ankY: -2, headX: 0, headY: 168 });
      const H = [24, 168];
      const E = elbowPt(B.SR, H, A1, A2, 'up');
      const hang = [-24, 80];
      const E2 = elbowPt(B.SL, hang, A1, A2, 'down');
      const parts = bar.concat(B.parts, [
        L(B.SR, E, { w: AW }), L(E, H, { w: AW }), Ci(E, 3, { fill: C.ink }), Ci(H, 4.6, { fill: C.ink })
      ], [
        // 另一条手臂垂放
        L(B.SL, E2, { w: AW }), L(E2, hang, { w: AW }), Ci(E2, 3, { fill: C.ink }), Ci(hang, 4.6, { fill: C.ink })
      ]);
      return { parts, tag: '正视' };
    }

    // 9 单臂辅助引体：单手握杠、另一只手抓杠上垂下的毛巾，比第 8 式拉得更高
    case 9: {
      const bar = barAt(-58, 58, 170);
      const B = bodyFront({ sx: 2, sy: 146, hx: 4, hy: 90, ankX: 14, ankY: 12, headX: 2, headY: 182 });
      const H = [22, 170];
      const E = elbowPt(B.SR, H, A1, A2, 'down');
      const grip = [-30, 161];
      const E2 = elbowPt(B.SL, grip, A1, A2, 'down');
      // 毛巾：搭在杠上垂下来的一条带子（先画，让杠和手压在它上面）
      const towel = [Rc([-33.5, 140], [-26.5, 180], { fill: C.white, stroke: C.soft, w: 1.8, rx: 1.5 })];
      const parts = towel.concat(bar, B.parts, [
        L(B.SR, E, { w: AW }), L(E, H, { w: AW }), Ci(E, 3, { fill: C.ink }), Ci(H, 4.6, { fill: C.ink }),
        L(B.SL, E2, { w: AW }), L(E2, grip, { w: AW }), Ci(E2, 3, { fill: C.ink }),
        Ci(grip, 5.4, { fill: C.white, stroke: C.ink, w: 3 }),
        Tx([-40, 152], '毛巾', { size: 9, fill: C.light, anchor: 'end' })
      ]);
      return { parts, tag: '正视' };
    }

    // 10 单臂引体：单手握杠、全幅度到下巴过杠，另一条手臂背在身后（虚线示意）
    case 10: {
      const bar = barAt(-58, 58, 166);
      const B = bodyFront({ sx: 8, sy: 140, hx: 10, hy: 84, ankX: 14, ankY: 6, headX: 8, headY: 178 });
      const H = [20, 166];
      const E = elbowPt(B.SR, H, A1, A2, 'up');
      const parts = bar.concat(B.parts, [
        L(B.SR, E, { w: AW }), L(E, H, { w: AW }), Ci(E, 3, { fill: C.ink }), Ci(H, 4.6, { fill: C.ink })
      ], [
        // 背在身后的手：虚线 + 手的位置点（与 topFig 的"behind"同一套画法）
        ...dashLine(B.SL, [0, 102], { w: 6.5 }),
        Ci([0, 100], 4.2, { fill: C.ink })
      ]);
      return { parts, tag: '正视' };
    }
  }
  return { parts: [], extra: null, tag: '' };
}
