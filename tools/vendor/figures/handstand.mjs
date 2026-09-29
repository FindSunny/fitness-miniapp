/**
 * 倒立撑（handstand）十式示意图 —— 黑色线条小人（侧视，略微转一点看到两只手）
 *
 * 为什么不是纯正侧视：倒立撑的"窄距 / 偏重 / 单手"这些特征只存在于左右方向上，
 * 纯侧视会把两只手臂叠成一条竖线（连头和身体也糊在一起），十式看起来一模一样。
 * 所以躯干、墙、头仍按侧视画（能看到弓背、贴墙、前倾），但两只手臂左右张开画出来，
 * 手撑成一个"八"字、头夹在中间 —— 这是动作图解里最常见的画法，抬眼看就懂。
 *
 * 约定（和 build-cards.mjs 的 figPushup / figSix 一致）：
 *   局部坐标 y 向上，地面 y = 0；手掌压在 y ≈ 0~6；身体从手往上升（高约 170~200）。
 *   头半径 11、上臂 30 / 前臂 27、躯干 48 / 大腿 42 / 小腿 36，十式同一套比例。
 *   墙：C.wall + url(#hatch) + 朝向人那侧的边界线（抄 figSix(5)）。
 *
 * 复用 build-cards.mjs 的零件：elbowPt（两段骨 IK 求肘；肩-手距离 ≥ 57 时自动成直臂）、
 * headAt（头 + 脖子）、floorLine（地面）、L / Ci / Pa / Rc / Tx / C。
 */
import { L, Ci, Pa, Rc, Tx, C, elbowPt, headAt, floorLine, rad } from '../build-cards.mjs';

const R = 11;                        // 头半径
const UA = 30, FA = 27;              // 上臂 / 前臂
const ARM = UA + FA;                 // 直臂 = 57
const TORSO = 48, THIGH = 42, SHIN = 36;
const HY = 6;                        // 掌心离地高度（掌点 r = 4.6，正好落在地面上）
const SHW = 6;                       // 肩点到身体中线的投影距离（略转 ~15°，两只手才分得开）
const HW = 18;                       // 正常握距：手到身体中线的投影距离（两手相距 36）
const SY = HY + Math.sqrt(ARM * ARM - (HW - SHW) ** 2);   // 直臂时肩的高度 ≈ 61.7

const pol = (p, a, d) => [p[0] + Math.sin(rad(a)) * d, p[1] + Math.cos(rad(a)) * d];
const off = (p, d) => [[p[0] - d, p[1]], [p[0] + d, p[1]]];

/**
 * 比例锚点：一条看不见的竖线（stroke=none + opacity=0），只进 bbox 不出墨。
 * 为什么需要：place() 按每格内容自动缩放，乌鸦式只有倒立的一半高，不锚住就会被放成两倍大；
 * 锚住之后十式同一个缩放比，地面线也落在每格同一高度。
 */
const anchor = () => L([0, -14], [0, 202], { w: 0.01, c: 'none', op: 0 });

/** 墙：fill C.wall + 一层 hatch + 朝向人的那条竖边描线（抄 figSix(5)） */
function wall(x0, x1, face) {
  return [
    Rc([x0, -12], [x1, 200], { fill: C.wall }),
    Rc([x0, -12], [x1, 200], { fill: 'url(#hatch)' }),
    L([face, -12], [face, 200], { w: 2.4, c: C.soft })
  ];
}

/** 绷直的脚尖：倒立时脚背顺小腿方向指出去（footAt 是站立用的平脚，这里用不上） */
function toe(ankle, ang) {
  const u = [Math.sin(rad(ang)), Math.cos(rad(ang))], q = [-u[1], u[0]];
  return Pa([
    [ankle[0] + q[0] * 5.5, ankle[1] + q[1] * 5.5],
    [ankle[0] + u[0] * 12, ankle[1] + u[1] * 12],
    [ankle[0] - q[0] * 4.5, ankle[1] - q[1] * 4.5]
  ], { closed: true, fill: C.ink, stroke: 'none' });
}

/**
 * 躯干 + 两条腿：sh = 肩中点，a1/a2/a3 = 躯干 / 大腿 / 小腿相对竖直方向的角度（正 = 偏向 +x）
 * 两条腿按 ±sp 投影分开画（略有 V 字），免得叠成一根柱子。
 */
function torso(sh, a1, a2, a3, sp = 5) {
  const shN = [sh[0] + SHW, sh[1]], shF = [sh[0] - SHW, sh[1]];
  const hip = pol(sh, a1, TORSO), knee = pol(hip, a2, THIGH), ankle = pol(knee, a3, SHIN);
  const [hipF, hipN] = off(hip, sp), [kneeF, kneeN] = off(knee, sp + 1), [ankleF, ankleN] = off(ankle, sp + 3);
  const parts = [
    L(shF, shN, { w: 9 }),                       // 肩
    L(sh, hip, { w: 10 }),                       // 躯干
    L(hipF, hipN, { w: 9 }),                     // 骨盆
    L(hipN, kneeN, { w: 9 }), L(kneeN, ankleN, { w: 9 }), toe(ankleN, a3),
    L(hipF, kneeF, { w: 9 }), L(kneeF, ankleF, { w: 9 }), toe(ankleF, a3),
    Ci(hip, 3.2, { fill: C.ink }), Ci(kneeN, 3, { fill: C.ink }), Ci(kneeF, 3, { fill: C.ink })
  ];
  return { shN, shF, hip, knee, ankle, parts };
}

/** 撑地的手臂：IK 求肘；肩-手距离 ≥ 57 时肘落在连线上 = 直臂。'up' 让肘往外张 */
function armIk(sh, hand, pr = 'up', w = 7) {
  const el = elbowPt(sh, hand, UA, FA, pr);
  return {
    el, parts: [L(sh, el, { w }), L(el, hand, { w }), Ci(el, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink })]
  };
}

/** 指定肘点的自由臂（另一只手扶墙 / 抵腰 / 撑球 / 背后） */
function armAt(sh, el, hand) {
  return [L(sh, el, { w: 7 }), L(el, hand, { w: 7 }), Ci(el, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink })];
}

/** 头：倒立时挂在肩下方；dx/dy = 头心相对肩中点的偏移 */
const headOf = (sh, dx, dy) => headAt([sh[0] + dx, sh[1] + dy], R, sh);

const withMark = mk => (b, tf) => floorLine(b, tf).concat(mk);

export function figHandstand(no) {
  switch (no) {
    // 1 顶墙倒立：背靠墙、手臂完全伸直，静态支撑，脚背贴墙
    case 1: {
      const sx = 22, sh = [sx, SY];
      const t = torso(sh, 4, -12, -15);                 // 背贴墙 → 髋离墙、小腿折回来贴墙
      return {
        parts: [
          anchor(), ...wall(-42, 0, 0),
          ...armIk(t.shF, [sx - HW, HY]).parts,           // 远侧手
          ...t.parts, ...headOf(sh, 0, -26),
          ...armIk(t.shN, [sx + HW, HY]).parts            // 近侧手（伸直）
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 2 乌鸦式：蹲姿手撑地、屈肘，膝盖顶在上臂上，脚离地（瑜伽乌鸦式）
    case 2: {
      const sx = 18, sy = 50;
      const aN = armIk([sx + SHW, sy], [sx + HW, HY]);   // 肘往上、往外
      const aF = armIk([sx - SHW, sy], [sx - HW, HY]);
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const kN = mid(aN.el, [sx + SHW, sy]), kF = mid(aF.el, [sx - SHW, sy]);  // 膝顶在上臂中段
      const hip = [sx + 2, 79.6];                        // 髋是全身最高点、缩在后头
      const leg = (k, sgn) => {                          // 小腿折回来、脚背朝上离地
        const ank = [k[0] + sgn * 4, k[1] + 36];
        const ang = Math.atan2(ank[0] - k[0], ank[1] - k[1]) * 180 / Math.PI;
        return [L(k, hip, { w: 9 }), L(k, ank, { w: 9 }), Ci(k, 3, { fill: C.ink }), toe(ank, ang)];
      };
      return {
        parts: [
          // 这一式故意不放比例锚线：乌鸦式本来就矮，锚住的话它会在 App 的 840×520 单图里
          // 变成一张小图（单图铺满画框比"十式同比例"更重要）。其余 9 式仍带 anchor()。
          ...aF.parts, ...aN.parts,                      // 先手臂，膝盖压在上面
          L([sx, sy], hip, { w: 10 }),                   // 弓着的躯干（肩 → 髋）
          ...leg(kN, 1), ...leg(kF, -1),
          Ci(hip, 3.2, { fill: C.ink }),
          ...headOf([sx, sy], 4, -26)                    // 头低而居中，夹在两臂之间
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 3 靠墙倒立（面墙）：手撑地、脚跟贴墙、身体接近垂直，静态
    case 3: {
      const sx = -24, sh = [sx, SY];
      const t = torso(sh, 6, 10, 14);                    // 整体朝墙那边倒 → 脚背贴墙
      return {
        parts: [
          anchor(), ...wall(0, 42, 0),
          ...armIk(t.shF, [sx - HW, HY]).parts,
          ...t.parts, ...headOf(sh, 0, -26),               // 脸朝墙，头离墙一点点
          ...armIk(t.shN, [sx + HW, HY]).parts
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 4 半倒立撑：靠墙倒立，屈肘只下放一半（头顶离地还有一段）
    case 4: {
      const sx = 22, sh = [sx, 50];
      const t = torso(sh, 4, -12, -15);
      const mark = [
        L([sx, 13], [sx, 1], { w: 1.6, c: C.red, dash: '5 4', cap: 'butt' }),
        Tx([sx + 4, 6], '半程', { size: 9, fill: C.red, anchor: 'start' })
      ];
      return {
        parts: [
          anchor(), ...wall(-42, 0, 0),
          ...armIk(t.shF, [sx - HW, HY]).parts,
          ...t.parts, ...headOf(sh, 0, -26),
          ...armIk(t.shN, [sx + HW, HY]).parts
        ],
        extra: withMark(mark), tag: '侧视'
      };
    }

    // 5 标准倒立撑：靠墙倒立，屈肘下放到头顶轻触地面
    case 5: {
      const sx = 22, sh = [sx, 38];
      const t = torso(sh, 4, -12, -16);
      return {
        parts: [
          anchor(), ...wall(-42, 0, 0),
          ...armIk(t.shF, [sx - HW, HY]).parts,
          ...t.parts, ...headOf(sh, 0, -27),               // 头顶正好落在地面
          ...armIk(t.shN, [sx + HW, HY]).parts
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 6 窄距倒立撑：双手并拢（窄距）下放，肘外张、头挤在两手之间
    case 6: {
      const sx = 0, sh = [sx, 40], NHW = 13;
      const t = torso(sh, 3, -11, -15);
      const mark = [
        L([sx + NHW, 4], [sx + 42, 16], { w: 1.6, c: C.blue, dash: '4 3', cap: 'butt' }),
        Tx([sx + 45, 20], '窄距', { size: 9, fill: C.blue, anchor: 'start' })
      ];
      return {
        parts: [
          anchor(),
          ...armIk(t.shF, [sx - NHW, HY]).parts,
          ...t.parts, ...headOf(sh, 0, -26),               // 头顶几乎贴地、夹在两手之间
          ...armIk(t.shN, [sx + NHW, HY]).parts
        ],
        extra: withMark(mark), tag: '侧视'
      };
    }

    // 7 偏重倒立撑：重心压在近侧手上（屈肘承重），远侧手几乎伸直只做平衡
    case 7: {
      const sx = 0, sh = [sx + 4, 42];
      const t = torso(sh, -6, -8, -10);                    // 躯干往承重手那边探、腿往反方向配重
      const aLoad = armIk(t.shN, [sx + 20, HY]);           // 承重手：屈肘，肘外张
      const handFar = [sx - 14, HY];
      const armFar = [L(t.shF, handFar, { w: 7 }), Ci(handFar, 4.6, { fill: C.ink })];  // 远侧手：伸直
      const mark = [
        L([sx + 40, 17], [sx + 23, 7], { w: 1.6, c: C.blue, dash: '4 3', cap: 'butt' }),
        Tx([sx + 42, 21], '重心', { size: 9, fill: C.blue, anchor: 'start' })
      ];
      return {
        parts: [
          anchor(), ...armFar, ...t.parts, ...headOf(sh, 3, -25), ...aLoad.parts
        ],
        extra: withMark(mark), tag: '侧视'
      };
    }

    // 8 单臂半倒立撑：单手撑地只下放一半，另一手抵在后腰
    case 8: {
      const sx = 0, sh = [sx + 4, 48];
      const t = torso(sh, 4, 2, 3, 5);
      const freeSh = t.shF, freeEl = elbowPt(freeSh, [t.hip[0] - 7, t.hip[1] - 6], UA, FA, 'up');
      return {
        parts: [
          anchor(), ...t.parts, ...headOf(sh, 1, -25),
          ...armAt(freeSh, freeEl, [t.hip[0] - 7, t.hip[1] - 6]),   // 空手抵腰
          ...armIk(t.shN, [sx + 14, HY]).parts                       // 单手支撑（半程）
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 9 杠杆倒立撑：单手为主，另一手撑在球（支撑物）上做杠杆辅助下放
    case 9: {
      const sx = 0, sh = [sx + 4, 46];
      const t = torso(sh, 4, 3, 4, 5);
      const ball = [sx - 40, 12], sup = [sx - 40, 25];
      const freeEl = elbowPt(t.shF, sup, UA, FA, 'up');
      return {
        parts: [
          anchor(), Ci(ball, 12, { fill: C.white, stroke: C.blue, w: 2.4, dash: '6 5' }),
          ...t.parts, ...headOf(sh, 1, -25),
          ...armAt(t.shF, freeEl, sup),                              // 空手压球借力
          ...armIk(t.shN, [sx + 16, HY]).parts
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    // 10 单臂倒立撑：单手撑地全幅度下放到头顶触地，另一手背在身后
    case 10: {
      const sx = 0, sh = [sx + 4, 38];
      const t = torso(sh, 4, 2, 3, 5);
      const back = [t.hip[0] - 7, t.hip[1] - 6];
      const freeEl = elbowPt(t.shF, back, UA, FA, 'up');
      return {
        parts: [
          anchor(), ...t.parts, ...headOf(sh, -1, -27),              // 头顶触地
          ...armAt(t.shF, freeEl, back),                             // 空手背在身后
          ...armIk(t.shN, [sx + 15, HY]).parts
        ],
        extra: floorLine, tag: '侧视'
      };
    }

    default: throw new Error(`figHandstand: no 只能是 1..10（收到 ${no}）`);
  }
}
