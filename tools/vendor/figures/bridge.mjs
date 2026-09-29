/**
 * 桥（Bridge）十式 · 侧视示意图
 *
 *   figBridge(no) → { parts, extra, tag }   no = 1..10
 *
 * 约定（与其它艺的示意图模块一致）：
 *   · 局部坐标 y 向上，地面在 y = 0，十式共用同一套「身体比例」
 *   · 单位≈厘米：头半径 11、大腿 42、小腿 45、上臂 30、前臂 27
 *   · 全部触地姿势都返回 extra: floorLine（地面线不参与自动缩放包围盒）
 *   · 人体零件一律复用 build-cards.mjs 的 headAt / footAt / elbowPt / Bz / L / Ci / Pa / Rc / Tx
 *     —— 这里只做「关节怎么摆」，不重画人体
 *
 * 画法约定：
 *   · 头永远最后画：headAt 的白色填充会把先画的（身后的）手臂线挡掉，
 *     正好得到「手臂绕到头后」的效果 —— figSix(4) 就是这么处理的
 *   · 手撑地时掌心圆点取 y = 5（半径 4.6 → 下沿贴住地面线）；脚掌贴地时踝取 y = 9
 */
import { L, Ci, Pa, Bz, Rc, Tx, C, headAt, footAt, elbowPt, floorLine } from '../build-cards.mjs';

const R = 11;          // 头半径
const AY = 9;          // 脚掌贴地时的踝高（footAt 底边落在 y = 0）
const HY = 5;          // 手撑地时的掌心高度
const THIGH = 42;      // 大腿
const SHIN = 45;       // 小腿
const UPPER = 30;      // 上臂
const FORE = 27;       // 前臂

// ---------- 零件组合 ----------
// 腿：踝→膝→髋（膝、髋画关节点，脚用 footAt）
function leg(hip, knee, ankle) {
  return [
    footAt(ankle, 1),
    L(ankle, knee, { w: 9 }), L(knee, hip, { w: 10 }),
    Ci(knee, 3.2, { fill: C.ink }), Ci(hip, 3.2, { fill: C.ink })
  ];
}
// 脊柱：髋→肩 的贝塞尔（控制点由各式给出，保证是平滑的弧而不是折线）
function spine(hip, sh, c1, c2) { return Bz([hip, c1, c2, sh], { w: 10 }); }
// 手臂：肩→手；straight = 直臂（肘落在连线上），dash = 身后那条（虚线 + 空心关节点）
function arm(sh, hand, o = {}) {
  const w = o.w || 7;
  const E = o.straight
    ? [sh[0] + (hand[0] - sh[0]) * 0.55, sh[1] + (hand[1] - sh[1]) * 0.55]
    : elbowPt(sh, hand, UPPER, FORE, o.prefer || 'up');
  const line = { w, c: C.ink, dash: o.dash, op: o.op };
  const out = [L(sh, E, line), L(E, hand, line)];
  out.push(o.dash
    ? Ci(E, 3, { fill: C.white, stroke: C.ink, w: 2.4, op: o.op })
    : Ci(E, 3, { fill: C.ink, op: o.op }));
  out.push(Ci(hand, 4.6, { fill: o.dash ? C.white : C.ink, stroke: o.dash ? C.ink : undefined, w: o.dash ? 2.4 : 0, op: o.op }));
  return out;
}
// 单向箭头（L 的 mk 会在两端都加箭头，方向示意自绘三角）
function arrow(a, b, o = {}) {
  const c = o.c || C.red, s = o.size || 7;
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d, px = -uy, py = ux;
  const base = [b[0] - ux * s * 1.5, b[1] - uy * s * 1.5];
  return [
    L(a, [b[0] - ux * s * 0.6, b[1] - uy * s * 0.6], { w: 2.2, c, cap: 'butt' }),
    Pa([b, [base[0] + px * s * 0.8, base[1] + py * s * 0.8], [base[0] - px * s * 0.8, base[1] - py * s * 0.8]],
      { closed: true, fill: c, stroke: 'none' })
  ];
}
// 墙 / 台阶：填充块 + 斜纹 + 靠人那侧画一条粗立面线（同 figPushup 的画法）
function block(a, b, o = {}) {
  const face = o.face === undefined ? b[0] : o.face;
  const other = face === a[0] ? b[0] : a[0];
  return [
    Rc(a, b, { fill: o.fill || C.wall }),
    Rc(a, b, { fill: 'url(#hatch)' }),
    L([other, a[1]], [other, b[1]], { w: 1.4, c: C.light }),
    L([face, a[1]], [face, b[1]], { w: 2.4, c: C.soft })
  ];
}

// ---------- 十式 ----------
export function figBridge(no) {
  switch (no) {
    // 1 短桥：仰卧屈膝，只有臀部微微离地（幅度很小），手臂伸直贴地放在身侧
    case 1: {
      const A = [62, AY], K = [40, 45], H = [0, 28], S = [-55, 8];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-20, 11], [-38, 7]),
          ...arm(S, [2, HY], { straight: true }),
          ...headAt([-72, 11], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // 2 直桥：双腿伸直、双臂伸直贴地，臀抬起，肩背仍贴地（身体像一道浅斜板）
    case 2: {
      const S = [-52, 8], H = [0, 34];
      const A = [83.3, AY], K = [40.2, 21.9];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-17, 25], [-35, 15]),
          ...arm(S, [5, HY], { straight: true }),
          ...headAt([-69, 11], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // 3 高低桥：双脚踩在台阶上，肩背着地，臀部抬起（脚高头低，膝比髋高）
    case 3: {
      const A = [88, 35], K = [107, 76], H = [71, 54], S = [34.4, 9];
      return {
        parts: [
          ...block([78, 0], [142, 26], { fill: C.fill, face: 78 }),
          ...leg(H, K, A),
          spine(H, S, [56, 42], [47, 12]),
          ...arm(S, [68, HY], { prefer: 'up' }),
          ...headAt([17, 11], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // 4 顶桥：脚 + 头着地，臀部向上顶到很高（头撑地，肩背离地），双手收在腹上
    case 4: {
      const A = [55, AY], K = [35, 45], H = [-1, 69], S = [-40, 30];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-14, 56], [-32, 34]),
          ...arm(S, [-8, 66], { prefer: 'down' }),
          ...headAt([-56, 11], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // 5 半桥：双手放在头两侧（屈肘、肘尖朝上撑地），髋只顶到半程
    case 5: {
      const A = [34, AY], K = [52, 48], H = [10, 43], S = [-35, 10];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-8, 22], [-24, 11]),
          ...arm(S, [-68, HY], { prefer: 'up' }),
          ...headAt([-52, 11], R, S)
        ],
        // 「半程」高度标注只放 extra（不参与包围盒，这一格的小人才能跟别格一样大）；
        // 标注本身画在包围盒内部（髋下方那根红箭头），单张铺满画框时不会被裁掉
        extra: (b, tf) => floorLine(b, tf).concat([
          ...arrow([14, 2], [14, H[1]], { size: 5.5 }),
          Tx([8, 22], '半程', { size: 8, fill: C.red, anchor: 'end' })
        ]),
        tag: '侧视'
      };
    }
    // 6 标准桥：手脚撑地，臀腰完全顶起成拱（= figSix(4) 那一式）
    case 6: {
      const A = [0, AY], K = [26, 50], H = [6, 80], S = [-36, 20];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-8, 64], [-30, 42]),
          ...arm(S, [-70, HY], { prefer: 'up' }),
          ...headAt([-54, 30], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
    // 7 下行桥：背对墙、双手扶墙，屈膝把身体慢慢往下放（红色箭头 = 下行方向）
    case 7: {
      const A = [56, AY], K = [33.4, 47.8], H = [6, 16], S = [-17, 62];
      return {
        parts: [
          ...block([-88, 0], [-66, 80]),
          ...leg(H, K, A),
          spine(H, S, [-2, 34], [-9, 52]),
          ...arm(S, [-66, 54], { prefer: 'down' }),
          ...headAt([-29, 73], R, S)
        ],
        extra: (b, tf) => floorLine(b, tf).concat(arrow([-77, 76], [-77, 30])),
        tag: '侧视'
      };
    }
    // 8 上行桥：从桥式沿墙撑起，脚踩地、手扶墙把身体推高（红色箭头 = 上行方向）
    case 8: {
      const A = [40, AY], K = [58, 50], H = [16, 62], S = [-36, 44];
      return {
        parts: [
          ...block([-116, 0], [-86, 84]),
          ...leg(H, K, A),
          spine(H, S, [0, 66], [-20, 52]),
          ...arm(S, [-86, 26], { prefer: 'down' }),
          ...headAt([-52, 50], R, S)
        ],
        extra: (b, tf) => floorLine(b, tf).concat(arrow([-101, 26], [-101, 72])),
        tag: '侧视'
      };
    }
    // 9 合桥：桥式撑起后抬起一只手（虚线 = 身后那只手仍在撑地）→ 三点支撑
    case 9: {
      const A = [0, AY], K = [26, 50], H = [6, 80], S = [-36, 20];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-8, 64], [-30, 42]),
          ...arm(S, [-70, HY], { dash: '6 5', op: 0.75, prefer: 'up' }),
          ...arm(S, [-58, 72], { prefer: 'up' }),
          ...headAt([-54, 30], R, S)
        ],
        extra: floorLine,
        tag: '侧视'
      };
    }
    // 10 铁板桥：双脚 + 双手四点支撑，髋顶到最高、腰背成拱（Bz）、腿基本伸直，身体绷成一块硬板
    case 10: {
      const A = [48, AY], K = [22, 48], H = [-2, 84], S = [-42, 27];
      return {
        parts: [
          ...leg(H, K, A),
          spine(H, S, [-16, 72], [-34, 52]),
          ...arm(S, [-76, HY], { prefer: 'up' }),
          ...headAt([-58, 34], R, S)
        ], extra: floorLine, tag: '侧视'
      };
    }
  }
}
