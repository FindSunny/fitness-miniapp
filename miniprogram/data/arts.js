/**
 * 六艺十式 · 结构化数据
 *
 * 数据来源：39 健康网《囚徒健身 6 艺 10 式》整理页 + 中译本常见标准
 *   https://fitness.39.net/qtjs/141028/4504262.html
 *
 * 字段说明
 *   std     三档标准，顺序固定为 [初级, 中级, 升级]，每档 = [组数, 数值]
 *   unit    'reps'（次）| 'sec'（秒，用于静止支撑类）
 *   perSide true 表示"每侧"计数
 *   art     动作示意图文件名（不含扩展名），null 表示图待补
 *   view    'side' 侧视 | 'top' 俯视（俯视图用来看手的位置）
 *   note    数据存疑时的说明（不隐藏问题，便于后续校对）
 *
 * ⚠️ 内容红线：本数据仅为动作名称/标准/姿势要点的结构化整理，
 *    不含原书文字与插图；示意图全部自绘。上线时以"训练工具"定位，
 *    文案不得出现"治疗/康复/矫正"等医疗表述。
 */

const TIER_NAMES = ['初级', '中级', '升级'];

const ARTS = [
  {
    id: 'pushup', order: 1, name: '俯卧撑', en: 'Push-Up',
    focus: '胸 · 肩 · 三头', tagline: '手比肩略宽 · 肘贴身 · 全身一条直线',
    source: 'https://fitness.39.net/qtjs/141028/4504262.html',
    steps: [
      { no: 1, name: '墙壁俯卧撑', en: 'Wall Push-Up', art: 'mov-pushup-01', view: 'side', std: [[1, 10], [2, 25], [3, 50]],
        cue: '手与肩同高、略宽于肩；头—肩—髋—踝一条直线，不塌腰不翘臀。' },
      { no: 2, name: '上斜俯卧撑', en: 'Incline Push-Up', art: 'mov-pushup-02', view: 'side', std: [[1, 10], [2, 20], [3, 40]],
        cue: '手撑桌沿或台阶，撑点越低越难；身体越平越吃力，全程不塌腰。' },
      { no: 3, name: '膝盖俯卧撑', en: 'Kneeling Push-Up', art: 'mov-pushup-03', view: 'side', std: [[1, 10], [2, 15], [3, 30]],
        cue: '膝着地，从膝到头顶一条直线；小腿贴地，别撅屁股。' },
      { no: 4, name: '半俯卧撑', en: 'Half Push-Up', art: 'mov-pushup-04', view: 'side', std: [[1, 8], [2, 12], [2, 25]],
        cue: '撑地平板姿势，只下到一半（约一拳高），肘约 90°，胸口不触地。' },
      { no: 5, name: '标准俯卧撑', en: 'Full Push-Up', art: 'mov-pushup-05', view: 'side', std: [[1, 5], [2, 10], [2, 20]],
        cue: '手在肩下、略宽于肩；胸口轻触地面，全身绷紧如一块板。' },
      { no: 6, name: '窄距俯卧撑', en: 'Close Push-Up', art: 'mov-pushup-06', view: 'top', std: [[1, 5], [2, 10], [2, 20]],
        cue: '双手并拢成菱形，肘贴身向后，不要外张。' },
      { no: 7, name: '偏重俯卧撑', en: 'Uneven Push-Up', art: 'mov-pushup-07', view: 'top', perSide: true, std: [[1, 5], [2, 10], [2, 20]],
        cue: '一手撑球、一手撑地，重心压向地面那只手，两边轮换。' },
      { no: 8, name: '单臂半俯卧撑', en: '1/2 One-Arm Push-Up', art: 'mov-pushup-08', view: 'top', perSide: true, std: [[1, 5], [2, 10], [2, 20]],
        cue: '单臂半程，另一只手背后；双脚放宽保持稳定。' },
      { no: 9, name: '杠杆俯卧撑', en: 'Lever Push-Up', art: 'mov-pushup-09', view: 'top', perSide: true, std: [[1, 5], [2, 10], [2, 20]],
        cue: '单臂为主，另一手伸直撑球做杠杆借力，逐步减小借力。' },
      { no: 10, name: '单臂俯卧撑', en: 'One-Arm Push-Up', art: 'mov-pushup-10', view: 'top', perSide: true, std: [[1, 5], [2, 5], [2, 10]],
        cue: '单臂全幅度，另一手背后，双脚最宽；宁慢勿假。',
        note: '源数据该式标准记载混乱（中级组次高于升级），此处按常见版本整理，建议以原书核对。' }
    ]
  },
  {
    id: 'squat', order: 2, name: '深蹲', en: 'Squat',
    focus: '腿 · 臀', tagline: '脚跟不离地 · 膝随脚尖 · 髋坐到最低',
    source: 'https://fitness.39.net/qtjs/141028/4504262_1.html',
    steps: [
      { no: 1, name: '肩倒立深蹲', en: 'Shoulderstand Squat', art: 'art-squat', view: 'side', std: [[1, 10], [2, 25], [3, 50]] },
      { no: 2, name: '折刀深蹲', en: 'Jackknife Squat', art: null, view: 'side', std: [[1, 10], [2, 20], [3, 40]] },
      { no: 3, name: '支撑深蹲', en: 'Supported Squat', art: null, view: 'side', std: [[1, 10], [2, 15], [3, 30]] },
      { no: 4, name: '半深蹲', en: 'Half Squat', art: null, view: 'side', std: [[1, 8], [2, 35], [3, 50]] },
      { no: 5, name: '标准深蹲', en: 'Full Squat', art: null, view: 'side', std: [[1, 5], [2, 10], [3, 30]] },
      { no: 6, name: '窄距深蹲', en: 'Close Squat', art: null, view: 'side', std: [[1, 5], [2, 10], [3, 20]] },
      { no: 7, name: '偏重深蹲', en: 'Uneven Squat', art: null, view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] },
      { no: 8, name: '单腿半深蹲', en: '1/2 One-Leg Squat', art: null, view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] },
      { no: 9, name: '单腿辅助深蹲', en: 'Assisted One-Leg Squat', art: null, view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] },
      { no: 10, name: '单腿深蹲', en: 'One-Leg Squat', art: 'art-squat', view: 'side', perSide: true, std: [[1, 5], [2, 10], [2, 50]] }
    ]
  },
  {
    id: 'pullup', order: 3, name: '引体向上', en: 'Pull-Up',
    focus: '背 · 二头', tagline: '沉肩挺胸 · 下巴过杠 · 不摆荡',
    source: 'https://fitness.39.net/qtjs/141028/4504262_2.html',
    steps: [
      { no: 1, name: '垂直引体', en: 'Vertical Pull', art: 'art-pullup', view: 'front', std: [[1, 10], [2, 20], [3, 40]] },
      { no: 2, name: '水平引体向上', en: 'Horizontal Pull', art: null, view: 'front', std: [[1, 10], [2, 20], [3, 30]] },
      { no: 3, name: '折刀引体向上', en: 'Jackknife Pull-Up', art: null, view: 'front', std: [[1, 10], [2, 15], [3, 20]] },
      { no: 4, name: '半引体向上', en: 'Half Pull-Up', art: null, view: 'front', std: [[1, 8], [2, 11], [3, 15]] },
      { no: 5, name: '标准引体向上', en: 'Full Pull-Up', art: 'art-pullup', view: 'front', std: [[1, 5], [2, 8], [3, 10]] },
      { no: 6, name: '窄距引体向上', en: 'Close Pull-Up', art: null, view: 'front', std: [[1, 5], [2, 8], [3, 10]] },
      { no: 7, name: '偏重引体向上', en: 'Uneven Pull-Up', art: null, view: 'front', perSide: true, std: [[1, 5], [2, 7], [3, 8]] },
      { no: 8, name: '单臂半引体向上', en: '1/2 One-Arm Pull-Up', art: null, view: 'front', perSide: true, std: [[1, 4], [2, 6], [2, 8]],
        note: '源数据中级(2×11)高于升级(2×8)，此处按单调递增修正为 2×6，建议以原书核对。' },
      { no: 9, name: '单臂辅助引体向上', en: 'Assisted One-Arm Pull-Up', art: null, view: 'front', perSide: true, std: [[1, 3], [2, 5], [2, 7]] },
      { no: 10, name: '单臂引体向上', en: 'One-Arm Pull-Up', art: null, view: 'front', perSide: true, std: [[1, 1], [2, 3], [2, 6]] }
    ]
  },
  {
    id: 'legraise', order: 4, name: '举腿', en: 'Leg Raise',
    focus: '腹 · 髋屈肌', tagline: '腹部发力 · 不借摆 · 腰背贴紧',
    source: 'https://fitness.39.net/qtjs/141028/4504262_3.html',
    steps: [
      { no: 1, name: '坐姿屈膝', en: 'Knee Tucks', art: null, view: 'side', std: [[1, 10], [2, 25], [3, 40]] },
      { no: 2, name: '平卧抬膝', en: 'Flat Knee Raises', art: null, view: 'side', std: [[1, 10], [2, 20], [3, 35]] },
      { no: 3, name: '平卧屈举腿', en: 'Flat Bent Leg Raises', art: null, view: 'side', std: [[1, 10], [2, 15], [3, 30]] },
      { no: 4, name: '平卧蛙举腿', en: 'Flat Frog Raises', art: null, view: 'side', std: [[1, 8], [2, 15], [3, 25]] },
      { no: 5, name: '平卧直举腿', en: 'Flat Straight Leg Raises', art: null, view: 'side', std: [[1, 5], [2, 10], [3, 20]] },
      { no: 6, name: '悬垂屈膝', en: 'Hanging Knee Raises', art: null, view: 'side', std: [[1, 5], [2, 10], [2, 15]] },
      { no: 7, name: '悬垂屈举腿', en: 'Hanging Bent Leg Raises', art: null, view: 'side', std: [[1, 5], [2, 10], [2, 15]] },
      { no: 8, name: '悬垂蛙举腿', en: 'Hanging Frog Raises', art: null, view: 'side', std: [[1, 5], [2, 10], [2, 15]] },
      { no: 9, name: '悬垂半举腿', en: 'Partial Straight Leg Raises', art: null, view: 'side', std: [[1, 5], [2, 10], [2, 15]] },
      { no: 10, name: '悬垂直举腿', en: 'Hanging Straight Leg Raises', art: 'art-legraise', view: 'side', std: [[1, 5], [2, 10], [2, 30]] }
    ]
  },
  {
    id: 'bridge', order: 5, name: '桥', en: 'Bridge',
    focus: '后链 · 脊柱', tagline: '肩背先落 · 臀部顶起 · 脊柱逐节展开',
    source: 'https://fitness.39.net/qtjs/141028/4504262_4.html',
    steps: [
      { no: 1, name: '短桥', en: 'Short Bridge', art: 'art-bridge', view: 'side', std: [[1, 10], [2, 25], [3, 50]] },
      { no: 2, name: '直桥', en: 'Straight Bridge', art: null, view: 'side', std: [[1, 10], [2, 20], [3, 40]] },
      { no: 3, name: '高低桥', en: 'Angled Bridge', art: null, view: 'side', std: [[1, 8], [2, 15], [3, 30]] },
      { no: 4, name: '顶桥', en: 'Head Bridge', art: null, view: 'side', std: [[1, 8], [2, 15], [3, 25]] },
      { no: 5, name: '半桥', en: 'Half Bridge', art: null, view: 'side', std: [[1, 8], [2, 15], [3, 20]] },
      { no: 6, name: '标准桥', en: 'Full Bridge', art: 'art-bridge', view: 'side', std: [[1, 6], [2, 10], [2, 15]] },
      { no: 7, name: '下行桥', en: 'Downward Bridge', art: null, view: 'side', std: [[1, 3], [2, 6], [2, 10]] },
      { no: 8, name: '上行桥', en: 'Upward Bridge', art: null, view: 'side', std: [[1, 2], [2, 4], [2, 8]] },
      { no: 9, name: '合桥', en: 'Closing Bridge', art: null, view: 'side', std: [[1, 1], [2, 3], [2, 6]] },
      { no: 10, name: '铁板桥', en: 'Stand-to-Stand Bridge', art: null, view: 'side', std: [[1, 1], [2, 3], [2, 30]] }
    ]
  },
  {
    id: 'handstand', order: 6, name: '倒立撑', en: 'Handstand Push-Up',
    focus: '肩 · 三头 · 平衡', tagline: '从靠墙开始 · 肘贴身 · 头顶成三角',
    source: 'https://fitness.39.net/qtjs/141028/4504262_5.html',
    steps: [
      { no: 1, name: '顶墙倒立', en: 'Wall Headstand', art: 'art-handstand', view: 'side', unit: 'sec', std: [[1, 30], [1, 60], [1, 120]] },
      { no: 2, name: '乌鸦式', en: 'Crow Stand', art: null, view: 'side', unit: 'sec', std: [[1, 10], [1, 30], [1, 60]] },
      { no: 3, name: '靠墙倒立', en: 'Wall Handstand', art: null, view: 'side', unit: 'sec', std: [[1, 30], [1, 60], [1, 120]] },
      { no: 4, name: '半倒立撑', en: 'Half Handstand Push-Up', art: null, view: 'side', std: [[1, 5], [2, 10], [3, 20]] },
      { no: 5, name: '标准倒立撑', en: 'Handstand Push-Up', art: null, view: 'side', std: [[1, 5], [2, 10], [3, 15]] },
      { no: 6, name: '窄距倒立撑', en: 'Close Handstand Push-Up', art: null, view: 'side', std: [[1, 5], [2, 9], [2, 12]] },
      { no: 7, name: '偏重倒立撑', en: 'Uneven Handstand Push-Up', art: null, view: 'side', perSide: true, std: [[1, 5], [2, 8], [2, 10]] },
      { no: 8, name: '单臂半倒立撑', en: '1/2 One-Arm Handstand Push-Up', art: null, view: 'side', perSide: true, std: [[1, 4], [2, 6], [2, 8]] },
      { no: 9, name: '杠杆倒立撑', en: 'Lever Handstand Push-Up', art: null, view: 'side', perSide: true, std: [[1, 3], [2, 4], [2, 6]] },
      { no: 10, name: '单臂倒立撑', en: 'One-Arm Handstand Push-Up', art: null, view: 'side', perSide: true, std: [[1, 1], [2, 2], [1, 5]] }
    ]
  }
];

// 补全 step 的 id（artId-no），供页面路由与记录使用
ARTS.forEach(art => {
  art.steps.forEach(step => {
    step.id = `${art.id}-${String(step.no).padStart(2, '0')}`;
    step.artId = art.id;
    step.unit = step.unit || 'reps';
    step.perSide = !!step.perSide;
  });
});

const ART_MAP = ARTS.reduce((m, a) => (m[a.id] = a, m), {});
const STEP_MAP = ARTS.reduce((m, a) => {
  a.steps.forEach(s => (m[s.id] = s));
  return m;
}, {});

function getArt(id) { return ART_MAP[id] || null; }
function getStep(artId, no) { return getStepById(`${artId}-${String(no).padStart(2, '0')}`); }
function getStepById(id) { return STEP_MAP[id] || null; }
function getNextStep(artId, no) { return no < 10 ? getStep(artId, no + 1) : null; }

module.exports = { ARTS, TIER_NAMES, ART_MAP, STEP_MAP, getArt, getStep, getStepById, getNextStep };
