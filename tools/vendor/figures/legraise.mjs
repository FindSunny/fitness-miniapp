/**
 * 举腿（Leg Raise）十式示意图
 *
 * 约定与 build-cards.mjs 一致：局部坐标 y 向上，地面 y = 0，调用方 place() 自动缩放居中。
 * 体型参数与 figSix / plank 完全同源：躯干 48、大腿 44、小腿 44、上臂 30、前臂 27、头 r=11。
 *
 * 视角说明：
 *   1–3、5  侧视（仰卧，脊柱贴在厚 7 的垫子上，垫面即"地面线"）
 *   4       俯视（仰卧蛙式，只有从上往下看才看得见"双膝分开"，这是本式的区别特征）
 *   6–7、9–10 侧视（悬垂，手抓杠，不画地面线）
 *   8       正视（悬垂蛙式，正面才看得见膝盖外展）
 */
import {
  C, L, Ci, Pa, Rc, footAt, headAt, elbowPt, floorLine, rad
} from '../build-cards.mjs';

// ---- 统一体型 ----
const TORSO = 48, THIGH = 44, SHIN = 44, UA = 30, FA = 27, HR = 11;
const MAT = 7;    // 垫子厚度
const LY = 12;    // 仰卧：脊柱中心线高度（垫面 7 + 半个躯干厚）
const HY = 18;    // 仰卧：头部圆心（后脑正好落在垫面上）
const BAR = 172;  // 单杠高度

const mat = (x0, x1) => Rc([x0, 0], [x1, MAT], { fill: C.fill, stroke: C.soft, w: 1.6, rx: 2 });
const jt = (p, r = 3.2) => Ci(p, r, { fill: C.ink });
// 从 a 出发、方向 ang(度)、长 len 的点
const pt = (a, ang, len) => [a[0] + Math.cos(rad(ang)) * len, a[1] + Math.sin(rad(ang)) * len];

// 与 footAt 同形，但脚尖可指向任意角度（悬垂时脚尖朝下/朝前）
function toeAt(a, ang = 0, len = 13) {
  const t = rad(ang), u = [Math.cos(t), Math.sin(t)], v = [-u[1], u[0]];
  const P = (f, s) => [a[0] + u[0] * f + v[0] * s, a[1] + u[1] * f + v[1] * s];
  return Pa([P(-8, -3), P(3, -3), P(len, 0), P(-9, 0)], { closed: true, fill: C.ink, stroke: 'none' });
}
// 俯视里的"脚"：与 topFig 同款，画成一条横杠
const footBar = (a, ang, half = 7) => L(
  [a[0] - Math.sin(rad(ang)) * half, a[1] + Math.cos(rad(ang)) * half],
  [a[0] + Math.sin(rad(ang)) * half, a[1] - Math.cos(rad(ang)) * half], { w: 6 });
// 贴地/贴垫的手臂（两段 + 肘），不用 IK：躺着时 IK 会把肘算到地面以下
const arm2 = (sh, hand, off = [0, -2]) => {
  const m = [(sh[0] + hand[0]) / 2 + off[0], (sh[1] + hand[1]) / 2 + off[1]];
  return [L(sh, m, { w: 7 }), L(m, hand, { w: 7 }), jt(m, 2.8), Ci(hand, 4.4, { fill: C.ink })];
};
// 单杠（横杠 + 两端立柱，立柱朝上，与 figSix 的杠同一画法）
const barAt = (y, x0 = -46, x1 = 46) => [
  L([x0, y], [x1, y], { w: 6, c: C.soft }),
  L([x0 + 5, y], [x0 + 5, y + 24], { w: 5, c: C.soft }),
  L([x1 - 5, y], [x1 - 5, y + 24], { w: 5, c: C.soft })
];
// 悬垂躯干：手抓杠 → 肩 → 髋 → 头。drop = 肩比手低多少（57 = 直臂；更小 = 沉肩屈臂拉起）
function hang({ bar = BAR, drop = 57 } = {}) {
  const hand = [-8, bar];
  const S = [0, bar - drop];
  const hip = [0, S[1] - TORSO];
  let arm;
  if (drop >= 52) {
    arm = [L(S, hand, { w: 7 }), Ci(hand, 4.6, { fill: C.ink })];
  } else { // 屈臂：拉起 / 沉肩时用 IK 摆肘
    const e = elbowPt(S, hand, UA, FA, 'down');
    arm = [L(S, e, { w: 7 }), L(e, hand, { w: 7 }), jt(e, 3), Ci(hand, 4.6, { fill: C.ink })];
  }
  return {
    hip, S,
    parts: [
      ...barAt(bar),
      Ci([hand[0] + 7, bar], 4.2, { fill: C.light }), // 远侧手
      ...arm,
      L(hip, S, { w: 10 }),
      ...headAt([S[0] + 12, S[1] + 19], HR, S)
    ]
  };
}

export function figLegraise(no) {
  switch (no) {
    // ---- 1 坐姿屈膝：坐在地上，双手在身后撑地，屈膝把膝盖收向胸口 ----
    case 1: {
      const hip = [0, LY];
      const sh = pt(hip, 115, TORSO);           // 上身后仰约 25°
      const head = pt(sh, 115, 22);
      const hand = [-12, 0];                    // 双手在身后撑地（手臂贴着躯干）
      const knee = [26, 47];                    // 膝盖收到身前胸口高度
      const ankle = [42, 6];                    // 脚掌踩在垫面上
      return {
        parts: [
          mat(-46, 58),
          L(hip, sh, { w: 10 }), ...headAt(head, HR, sh),
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          footAt(ankle, 1),
          ...arm2(sh, hand, [-1, 0])
        ], extra: floorLine, tag: '侧视'
      };
    }
    // ---- 2 平卧抬膝：仰卧、双手放身侧，屈膝把膝盖抬向胸口（脚离地） ----
    case 2: {
      const hip = [0, LY], sh = [-48, LY], head = [-68, HY];
      const knee = [-28, 47], ankle = [8, 22], hand = [0, 5];
      return {
        parts: [
          mat(-86, 12),
          L(hip, sh, { w: 10 }), ...headAt(head, HR, sh),
          ...arm2(sh, hand, [0, -4]),
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, -45)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // ---- 3 平卧屈举腿：仰卧，膝保持约 90°，大腿抬到垂直，小腿水平前伸 ----
    case 3: {
      const hip = [0, LY], sh = [-48, LY], head = [-68, HY];
      const knee = pt(hip, 90, THIGH);              // 大腿垂直
      const ankle = pt(knee, 0, SHIN);              // 小腿水平前伸
      const hand = [4, 8];
      return {
        parts: [
          mat(-86, 12),
          L(hip, sh, { w: 10 }), ...headAt(head, HR, sh),
          ...arm2(sh, hand, [0, -2]),
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, 90)                            // 仰卧姿势的脚：脚尖朝上
        ], extra: floorLine, tag: '侧视'
      };
    }
    // ---- 4 平卧蛙举腿：仰卧蛙式，双膝分开、脚拉向臀部（俯视才看得清"分开"） ----
    case 4: {
      const head = [0, 152], sh = [0, 138], hip = 96;
      const kL = [-48, 68], kR = [48, 68];
      const aL = [-6, 84], aR = [6, 84];
      const hL = [-18, 108], hR = [18, 108];
      const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / Math.PI * 180;
      return {
        parts: [
          Pa([[-22, sh[1]], [22, sh[1]], [15, hip], [-15, hip]], { closed: true, fill: C.fill, stroke: C.ink, w: 4 }),
          L([-21, sh[1]], [21, sh[1]], { w: 7 }),
          L([-21, 136], [-38, 118], { w: 7 }), L([-38, 118], hL, { w: 7 }), jt([-38, 118], 2.8),
          L([21, 136], [38, 118], { w: 7 }), L([38, 118], hR, { w: 7 }), jt([38, 118], 2.8),
          Ci(hL, 4.4, { fill: C.ink }), Ci(hR, 4.4, { fill: C.ink }),
          L([-15, hip], kL, { w: 9 }), L(kL, aL, { w: 9 }),
          L([15, hip], kR, { w: 9 }), L(kR, aR, { w: 9 }),
          jt([-15, hip]), jt([15, hip]), jt(kL), jt(kR),
          footBar(aL, ang(kL, aL)), footBar(aR, ang(kR, aR)),
          ...headAt(head, 12, sh)
        ], extra: null, tag: '俯视'
      };
    }
    // ---- 5 平卧直举腿：仰卧、双腿伸直抬到垂直 ----
    case 5: {
      const hip = [0, LY], sh = [-48, LY], head = [-68, HY];
      const knee = pt(hip, 90, THIGH);
      const ankle = pt(knee, 90, SHIN);
      const hand = [4, 8];
      return {
        parts: [
          mat(-86, 10),
          L(hip, sh, { w: 10 }), ...headAt(head, HR, sh),
          ...arm2(sh, hand, [0, -2]),
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, 180)                           // 直腿抬起后脚尖朝头（踝背屈 90°）
        ], extra: floorLine, tag: '侧视'
      };
    }
    // ---- 6 悬垂屈膝：悬挂，屈膝把膝盖收到胸口（小腿垂在膝下） ----
    case 6: {
      const { parts, hip } = hang();
      const knee = pt(hip, 48, THIGH);
      const ankle = pt(knee, -85, SHIN);
      return {
        parts: parts.concat([
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, -85)
        ]), extra: null, tag: '侧视'
      };
    }
    // ---- 7 悬垂屈举腿：悬垂，膝保持 90°，大腿抬到水平以上 ----
    case 7: {
      const { parts, hip } = hang();
      const knee = pt(hip, 22, THIGH);
      const ankle = pt(knee, -68, SHIN);
      return {
        parts: parts.concat([
          L(hip, knee, { w: 9 }), L(knee, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, -68)
        ]), extra: null, tag: '侧视'
      };
    }
    // ---- 8 悬垂蛙举腿：悬垂蛙式，膝分开、向上蹬伸（正视才看得清膝盖外展） ----
    case 8: {
      const barY = 172, shY = 115, hipY = 67;
      const kL = [-58, 78], kR = [58, 78];
      const aL = [-30, 45], aR = [30, 45];
      return {
        parts: [
          ...barAt(barY, -54, 54),
          L([-18, shY], [-20, barY], { w: 7 }), Ci([-20, barY], 4.6, { fill: C.ink }),
          L([18, shY], [20, barY], { w: 7 }), Ci([20, barY], 4.6, { fill: C.ink }),
          Pa([[-20, 113], [20, 113], [16, hipY], [-16, hipY]], { closed: true, fill: C.fill, stroke: C.ink, w: 4 }),
          L([-19, 113], [19, 113], { w: 7 }),
          L([-16, hipY], kL, { w: 9 }), L(kL, aL, { w: 9 }),
          L([16, hipY], kR, { w: 9 }), L(kR, aR, { w: 9 }),
          jt([-16, hipY]), jt([16, hipY]), jt(kL), jt(kR),
          toeAt(aL, -90), toeAt(aR, -90),
          ...headAt([0, 139], 12, [0, 116])
        ], extra: null, tag: '正视'
      };
    }
    // ---- 9 悬垂半举腿：悬垂，直腿抬到大约水平 ----
    case 9: {
      const { parts, hip } = hang();
      const knee = pt(hip, 6, THIGH);
      const ankle = pt(hip, 6, THIGH + SHIN);
      return {
        parts: parts.concat([
          L(hip, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, 6)
        ]), extra: null, tag: '侧视'
      };
    }
    // ---- 10 悬垂直举腿：悬垂，直腿举到脚尖碰杠（沉肩屈臂把身体带起来） ----
    case 10: {
      const { parts, hip } = hang({ drop: 46 });
      const ang = 65;                       // 髋屈约 155°，脚尖够到杠
      const knee = pt(hip, ang, THIGH);
      const ankle = pt(hip, ang, THIGH + SHIN);
      return {
        parts: parts.concat([
          L(hip, ankle, { w: 9 }), jt(hip), jt(knee),
          toeAt(ankle, ang)
        ]), extra: null, tag: '侧视'
      };
    }
    default:
      throw new Error(`legraise: 没有第 ${no} 式（只有 1..10）`);
  }
}
