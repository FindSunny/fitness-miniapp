/**
 * 深蹲十式 · 极简黑色线稿火柴人（侧视为主，第 6 式附图看站距）
 *
 * 约定：figSquat(no) -> { parts, extra, tag }，no = 1..10
 *   局部坐标 y 向上，地面 y = 0。脚掌底正好压在 y = 0 的地面线上
 *   （脚踝 ANK = 9，build-cards 的 footAt 会把脚掌底面钉在 y = 0）。
 *   人体零件全部复用 ../build-cards.mjs（elbowPt / headAt / footAt / floorLine），
 *   十式共用下面这套比例常量 —— 要调肢体长度请改常量，别在单个动作里改。
 */
import { L, Ci, Pa, Rc, Tx, C, elbowPt, headAt, footAt, floorLine, rad } from '../build-cards.mjs';

/* ---------------- 十式共用比例 ---------------- */
const ANK = 9;                              // 踝点高度：footAt 脚掌底恒在 y = 0（踩在地面线上）
const THIGH = 46, SHANK = 46, TRUNK = 48;   // 大腿 / 小腿 / 躯干
const UPPER = 30, FORE = 27;                // 上臂 / 前臂
const HEAD_R = 11;
const W_TRUNK = 10, W_LEG = 9, W_ARM = 7.5;
// 隐形竖向标尺：只参与包围盒，把十式的自动缩放钉成同一比例、地面线钉在同一高度
const RULER_BOT = -20, RULER_TOP = 150;
const ruler = x => [L([x, RULER_BOT], [x, RULER_TOP], { w: 0, op: 0 })];

/* ---------------- 人体零件 ---------------- */
// 膝关节：两骨等长、两个解。默认取"膝朝上/朝前"的解；
// 前伸的直腿若与支撑腿的膝撞在一起，就用 bend:'down' 让直腿的微弯朝下
const kneeOf = (hip, ankle, bend) => elbowPt(hip, ankle, THIGH, SHANK, bend === 'down' ? 'down' : 'up');
// 离地的脚：不能用 footAt（它把脚掌底固定钉在 y = 0，会拖出一条到地面的楔形）；
// 形状沿用 build-cards 里画悬空脚的做法（figSix 举腿 / 桥那两式）
const airFoot = (a, dir = 1) => Pa([
  [a[0] - 6 * dir, a[1] + 1], [a[0] + 7 * dir, a[1] + 7], [a[0] + 10 * dir, a[1] - 1], [a[0] - 3 * dir, a[1] - 4]
], { closed: true, fill: C.ink, stroke: 'none' });

function legTo(ankle, hip, o = {}) {           // 踩地的腿
  const K = kneeOf(hip, ankle, o.bend);
  return { K, parts: [footAt(ankle, o.dir === -1 ? -1 : 1), L(ankle, K, { w: W_LEG }), L(K, hip, { w: W_LEG }), Ci(K, 3.2, { fill: C.ink })] };
}
function airLeg(hip, ankle, o = {}) {          // 离地的腿
  const K = kneeOf(hip, ankle, o.bend);
  return { K, parts: [L(ankle, K, { w: W_LEG }), L(K, hip, { w: W_LEG }), Ci(K, 3.2, { fill: C.ink }), airFoot(ankle, o.dir === -1 ? -1 : 1)] };
}
function trunkAt(hip, sh) {                    // 躯干 + 髋点 + 头颈（头顺着脊柱延长线摆）
  const dx = sh[0] - hip[0], dy = sh[1] - hip[1], d = Math.hypot(dx, dy) || 1;
  const HC = [sh[0] + dx / d * (HEAD_R + 9), sh[1] + dy / d * (HEAD_R + 9)];
  return {
    HC,
    parts: [L(hip, sh, { w: W_TRUNK }), Ci(hip, 3.4, { fill: C.ink })],
    head: headAt(HC, HEAD_R, sh)
  };
}
// 肩点：从髋出发，leanDeg 前倾角（+ = 向前 / 画面右侧）
const shoulderOf = (hip, leanDeg, len = TRUNK) =>
  [hip[0] + Math.sin(rad(leanDeg)) * len, hip[1] + Math.cos(rad(leanDeg)) * len];
// 手的位置：从肩出发，deg 方向（0 = 正前方水平），len 距离
const reach = (sh, deg, len) => [sh[0] + Math.cos(rad(deg)) * len, sh[1] + Math.sin(rad(deg)) * len];
function armTo(sh, hand, prefer = 'down') {
  const E = elbowPt(sh, hand, UPPER, FORE, prefer);
  return { E, parts: [L(sh, E, { w: W_ARM }), L(E, hand, { w: W_ARM }), Ci(E, 3, { fill: C.ink }), Ci(hand, 4.6, { fill: C.ink })] };
}
// 水平参考虚线 + 端点小字（标"膝高""半程"这类幅度提示）
const levelLine = (b, y, label, color = C.light) => [
  L([b.x0 - 6, y], [b.x1 + 6, y], { w: 1.6, c: color, dash: '6 5' }),
  Tx([b.x0 - 10, y - 3], label, { size: 9, fill: color, anchor: 'end' })
];
// 固定物（门框 / 柱子）
const postAt = (x0, x1, top) => [
  Rc([x0, -2], [x1, top], { fill: C.wall, stroke: C.soft, w: 1.6 }),
  L([x0, -2], [x0, top], { w: 2.4, c: C.soft })
];
// 徒手全幅度深蹲（标准式）：第 5 式主图；第 6 式复用同一姿势，只多一张站距小图
function deepSquat(ankleX) {
  const hip = [ankleX - 32, 40], sh = shoulderOf(hip, 45);
  const leg = legTo([ankleX, ANK], hip);
  const t = trunkAt(hip, sh);
  return { K: leg.K, parts: [...t.parts, ...leg.parts, ...armTo(sh, reach(sh, 3, 55), 'down').parts, ...t.head] };
}
// 细节小图（第 6 式）：正视看"双脚并拢"。正视图看不出下蹲的深浅，
// 所以主图仍用侧视全蹲，站距单独圈一张小图 —— 一眼就能读出这一式的区别
const stanceInset = () => [
  Ci([-42, 104], 30, { fill: 'none', stroke: C.light, w: 1.6, dash: '6 5' }),
  L([-58, 88], [-22, 88], { w: 1.4, c: C.light, dash: '5 4' }),
  L([-52, 122], [-32, 122], { w: 6 }),                                    // 髋（正视的髋线）
  L([-52, 122], [-58, 108], { w: 6.5 }), L([-58, 108], [-46, 90], { w: 6.5 }),
  L([-32, 122], [-26, 108], { w: 6.5 }), L([-26, 108], [-34, 90], { w: 6.5 }),
  Ci([-58, 108], 2.6, { fill: C.ink }), Ci([-26, 108], 2.6, { fill: C.ink }),
  Pa([[-51, 92], [-41, 92], [-42, 88], [-52, 88]], { closed: true, fill: C.ink, stroke: 'none' }),
  Pa([[-39, 92], [-29, 92], [-28, 88], [-38, 88]], { closed: true, fill: C.ink, stroke: 'none' }),
  Tx([-42, 64], '双脚并拢', { size: 10, fill: C.gray })
];

/* ---------------- 十式 ---------------- */
export function figSquat(no) {
  switch (no) {
    /* 1. 肩倒立深蹲 —— 仰卧，肩背着地，双手撑腰，双腿折到头顶上方（回滚式） */
    case 1: {
      const S = [-16, 7], hip = [11.5, 46.3];         // 肩背贴地，上身斜向上，髋抬到最高
      const K = [-16, 85], ankle = [-55, 60];         // 大腿举过头顶、小腿折回，脚在头顶上方
      return {
        parts: [
          L(S, hip, { w: W_TRUNK }), Ci(hip, 3.4, { fill: C.ink }),
          L(hip, K, { w: W_LEG }), L(K, ankle, { w: W_LEG }),
          airFoot(ankle, -1), Ci(K, 3.2, { fill: C.ink }),
          // 双手撑腰：上臂平放在地面上，前臂立起来托住后腰
          L(S, [13, 4], { w: W_ARM }), L([13, 4], [8, 28], { w: W_ARM }),
          Ci([13, 4], 3, { fill: C.ink }), Ci([8, 28], 4.6, { fill: C.ink }),
          ...headAt([-38, 11], HEAD_R, S),              // 头枕在地上（肩旁）
          ...ruler(-10)
        ],
        // 这一式最不像"深蹲"，补一句小字说明起止姿势（回滚式）
        extra: (b, tf) => floorLine(b, tf).concat([
          Tx([(b.x0 + b.x1) / 2, -7], '肩背撑地 · 双手撑腰 · 回滚式', { size: 9, fill: C.gray })
        ]), tag: '侧视'
      };
    }

    /* 2. 折刀深蹲 —— 屈髋、上身折向前，双手扶膝，膝盖前推 */
    case 2: {
      const hip = [6, 64], sh = shoulderOf(hip, 45);
      const leg = legTo([34, ANK], hip);
      const t = trunkAt(hip, sh);
      const hand = [leg.K[0] + 2, leg.K[1] + 8];      // 手压在膝盖上
      return {
        parts: [
          ...t.parts, ...leg.parts,
          ...armTo(sh, hand, 'down').parts,
          ...t.head, ...ruler(leg.K[0] - 12)
        ], extra: floorLine, tag: '侧视'
      };
    }

    /* 3. 支撑深蹲 —— 双手抓住身前的固定物，借力下蹲 */
    case 3: {
      const hip = [-14, 52], sh = shoulderOf(hip, 6);
      const leg = legTo([10, ANK], hip);
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...postAt(45, 61, 148),
          ...t.parts, ...leg.parts,
          ...armTo(sh, [46, 98], 'down').parts,
          ...t.head, ...ruler(2)
        ], extra: floorLine, tag: '侧视'
      };
    }

    /* 4. 半深蹲 —— 徒手，只下到大腿接近水平（半程） */
    case 4: {
      const hip = [4, 62], sh = shoulderOf(hip, 20);
      const leg = legTo([32, ANK], hip);
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...t.parts, ...leg.parts,
          ...armTo(sh, reach(sh, 4, 54), 'down').parts,
          ...t.head, ...ruler(leg.K[0] - 14)
        ],
        extra: (b, tf) => floorLine(b, tf).concat(levelLine(b, leg.K[1], '膝高'), [
          Tx([b.x0 - 10, leg.K[1] + 16], '半程', { size: 10, fill: C.red, anchor: 'end' })
        ]), tag: '侧视'
      };
    }

    /* 5. 标准深蹲 —— 徒手全幅度，髋低于膝，脚跟不离地，双手前平举 */
    case 5: {
      const f = deepSquat(34);
      return {
        parts: f.parts.concat(ruler(f.K[0] - 16)),
        extra: (b, tf) => floorLine(b, tf).concat(levelLine(b, f.K[1], '膝高'), [
          Tx([b.x0 - 10, f.K[1] + 16], '全程', { size: 10, fill: C.red, anchor: 'end' })
        ]), tag: '侧视'
      };
    }

    /* 6. 窄距深蹲 —— 双脚并拢，其余同标准深蹲（附图看站距） */
    case 6: {
      const f = deepSquat(34);
      return {
        parts: f.parts.concat(ruler(f.K[0] - 16)),
        extra: (b, tf) => floorLine(b, tf).concat(stanceInset()),
        tag: '侧视 · 小图看站距'
      };
    }

    /* 7. 偏重深蹲 —— 一腿承重下蹲，另一腿前伸踩地，重心偏向后腿 */
    case 7: {
      const hip = [0, 72], sh = shoulderOf(hip, 25);
      const legS = legTo([12, ANK], hip);                     // 承重腿：屈膝下蹲
      const legF = legTo([60, ANK], hip, { bend: 'down' });   // 前伸腿：几乎伸直，脚掌踩地
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...t.parts, ...legF.parts, ...legS.parts,
          ...armTo(sh, reach(sh, 2, 54), 'down').parts,
          ...t.head, ...ruler(24)
        ],
        extra: (b, tf) => floorLine(b, tf).concat([
          Tx([b.x0 - 12, 132], '重心偏向后腿', { size: 9, fill: C.red, anchor: 'end' })
        ]), tag: '侧视'
      };
    }

    /* 8. 单腿半深蹲 —— 单腿支撑只到半程，另一腿前伸离地 */
    case 8: {
      const hip = [2, 64], sh = shoulderOf(hip, 30);
      const legS = legTo([22, ANK], hip);
      const legF = airLeg(hip, [78, 30]);
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...t.parts, ...legS.parts, ...legF.parts,
          ...armTo(sh, reach(sh, 6, 54), 'down').parts,
          ...t.head, ...ruler(legS.K[0] - 16)
        ], extra: floorLine, tag: '侧视'
      };
    }

    /* 9. 单腿辅助深蹲 —— 单腿下蹲到底，一只手扶住固定物借力，另一腿前伸离地 */
    case 9: {
      const hip = [0, 42], sh = shoulderOf(hip, 45);
      const legS = legTo([26, ANK], hip);
      const legF = airLeg(hip, [70, 36]);
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...postAt(92, 108, 140),
          ...t.parts, ...legS.parts, ...legF.parts,
          ...armTo(sh, [90, 78], 'down').parts,
          ...t.head, ...ruler(legS.K[0] - 16)
        ], extra: floorLine, tag: '侧视'
      };
    }

    /* 10. 单腿深蹲 —— 完全单腿到底，另一腿前伸与地面平行，双手前平举 */
    default: {
      const hip = [-6, 42], sh = shoulderOf(hip, 45);
      const legS = legTo([26, ANK], hip);
      const legF = airLeg(hip, [86, 38], { bend: 'down' });   // 笔直前伸、与地面平行
      const t = trunkAt(hip, sh);
      return {
        parts: [
          ...t.parts, ...legF.parts, ...legS.parts,
          ...armTo(sh, reach(sh, 2, 54), 'down').parts,
          ...t.head, ...ruler(legS.K[0] - 16)
        ], extra: floorLine, tag: '侧视'
      };
    }
  }
}
