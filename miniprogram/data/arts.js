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
    gear: '一面墙；上斜俯卧撑还要一张桌子或台阶',
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
        note: '不同资料对这一式的组数记载不一致，本表按常见版本整理；以你能标准完成的次数为准。' }
    ]
  },
  {
    id: 'squat', order: 2, name: '深蹲', en: 'Squat',
    focus: '腿 · 臀', tagline: '脚跟不离地 · 膝随脚尖 · 髋坐到最低',
    gear: '一根门框或柱子（支撑深蹲、单腿辅助深蹲借力用）',
    source: 'https://fitness.39.net/qtjs/141028/4504262_1.html',
    steps: [
      { no: 1, name: '肩倒立深蹲', en: 'Shoulderstand Squat', art: 'mov-squat-01', view: 'side', std: [[1, 10], [2, 25], [3, 50]] ,
        cue: '肩背贴地、双手撑腰，双腿折到头顶上方再蹬起；别用脖子和腰硬撑。'},
      { no: 2, name: '折刀深蹲', en: 'Jackknife Squat', art: 'mov-squat-02', view: 'side', std: [[1, 10], [2, 20], [3, 40]] ,
        cue: '屈髋前折、双手扶膝，上身尽量伏低、膝往前推；别弓背也别让脚跟离地。'},
      { no: 3, name: '支撑深蹲', en: 'Supported Squat', art: 'mov-squat-03', view: 'side', std: [[1, 10], [2, 15], [3, 30]] ,
        cue: '双手抓牢身前固定物，靠手臂分担负重蹲到底；别把体重全挂在手上。'},
      { no: 4, name: '半深蹲', en: 'Half Squat', art: 'mov-squat-04', view: 'side', std: [[1, 8], [2, 35], [3, 50]] ,
        cue: '只蹲到大腿接近水平就停住，节奏放稳；别探膝，也别借惯性弹起来。'},
      { no: 5, name: '标准深蹲', en: 'Full Squat', art: 'mov-squat-05', view: 'side', std: [[1, 5], [2, 10], [3, 30]] ,
        cue: '脚跟踩实、膝随脚尖方向，髋往后坐到最低；别塌腰，别让脚跟抬起来。'},
      { no: 6, name: '窄距深蹲', en: 'Close Squat', art: 'mov-squat-06', view: 'side', std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '双脚并拢站，其余同标准深蹲，全程慢下慢起；别外翻膝盖也别踮脚。'},
      { no: 7, name: '偏重深蹲', en: 'Uneven Squat', art: 'mov-squat-07', view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '一腿屈膝下蹲、另一腿前伸脚尖点地，重心压回下蹲腿；别向侧面歪。'},
      { no: 8, name: '单腿半深蹲', en: '1/2 One-Leg Squat', art: 'mov-squat-08', view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '单腿支撑只蹲到一半，另一腿前伸悬空；膝对准脚尖，别左右晃。'},
      { no: 9, name: '单腿辅助深蹲', en: 'Assisted One-Leg Squat', art: 'mov-squat-09', view: 'side', perSide: true, std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '单腿下蹲到底，一只手扶固定物借一点力；别全靠手拉，也别歪身。'},
      { no: 10, name: '单腿深蹲', en: 'One-Leg Squat', art: 'mov-squat-10', view: 'side', perSide: true, std: [[1, 5], [2, 10], [2, 50]] ,
        cue: '单腿蹲到底，另一腿前伸与地面平行，双手前平举；别猛起借力。'}
    ]
  },
  {
    id: 'pullup', order: 3, name: '引体向上', en: 'Pull-Up',
    focus: '背 · 二头', tagline: '沉肩挺胸 · 下巴过杠 · 不摆荡',
    gear: '一根单杠（门框单杠也行）',
    source: 'https://fitness.39.net/qtjs/141028/4504262_2.html',
    steps: [
      { no: 1, name: '垂直引体', en: 'Vertical Pull', art: 'mov-pullup-01', view: 'front', std: [[1, 10], [2, 20], [3, 40]] ,
        cue: '双手抓门框、身体后倾，用背带手臂把身体拉向门框；脚不离地，别耸肩。'},
      { no: 2, name: '水平引体向上', en: 'Horizontal Pull', art: 'mov-pullup-02', view: 'front', std: [[1, 10], [2, 20], [3, 30]] ,
        cue: '低杠下脚跟着地、身体绷成板，胸口拉向杠；别只用手拽，也别塌腰。'},
      { no: 3, name: '折刀引体向上', en: 'Jackknife Pull-Up', art: 'mov-pullup-03', view: 'front', std: [[1, 10], [2, 15], [3, 20]] ,
        cue: '双脚踩凳、身体折刀式，下巴朝杠拉起；靠背发力，别蹬腿抢劲。'},
      { no: 4, name: '半引体向上', en: 'Half Pull-Up', art: 'mov-pullup-04', view: 'front', std: [[1, 8], [2, 11], [3, 15]] ,
        cue: '悬垂屈臂只拉到一半，肘约九十度停住；别耸肩，也别靠摆荡偷力。'},
      { no: 5, name: '标准引体向上', en: 'Full Pull-Up', art: 'mov-pullup-05', view: 'front', std: [[1, 5], [2, 8], [3, 10]] ,
        cue: '正手握杠略宽于肩，沉肩挺胸拉到下巴过杠；别摆荡，别半途就松劲。'},
      { no: 6, name: '窄距引体向上', en: 'Close Pull-Up', art: 'mov-pullup-06', view: 'front', std: [[1, 5], [2, 8], [3, 10]] ,
        cue: '双手并拢至与头同宽，其余同标准引体；拉起时肘别外张。'},
      { no: 7, name: '偏重引体向上', en: 'Uneven Pull-Up', art: 'mov-pullup-07', view: 'front', perSide: true, std: [[1, 5], [2, 7], [3, 8]] ,
        cue: '一手握杠为主拉，另一手抓自己前臂借力；两边轮换，别歪着拉。'},
      { no: 8, name: '单臂半引体向上', en: '1/2 One-Arm Pull-Up', art: 'mov-pullup-08', view: 'front', perSide: true, std: [[1, 4], [2, 6], [2, 8]],
        cue: '单手握杠只拉到一半，另一手自然垂放；身体别晃，也别急着加幅度。',
        note: '不同资料对这一式的次数记载不一致，本表按由易到难整理；以标准动作下的次数为准。' },
      { no: 9, name: '单臂辅助引体向上', en: 'Assisted One-Arm Pull-Up', art: 'mov-pullup-09', view: 'front', perSide: true, std: [[1, 3], [2, 5], [2, 7]] ,
        cue: '单手握杠，另一手抓杠上垂下的毛巾借力；控制慢起慢落，别猛拽。'},
      { no: 10, name: '单臂引体向上', en: 'One-Arm Pull-Up', art: 'mov-pullup-10', view: 'front', perSide: true, std: [[1, 1], [2, 3], [2, 6]] ,
        cue: '单手握杠全幅度拉到下巴过杠，另一手背在身后；宁慢勿假，别甩腿。'}
    ]
  },
  {
    id: 'legraise', order: 4, name: '举腿', en: 'Leg Raise',
    focus: '腹 · 髋屈肌', tagline: '腹部发力 · 不借摆 · 腰背贴紧',
    gear: '后五式是悬垂动作，需要一根单杠；前五式在地面即可',
    source: 'https://fitness.39.net/qtjs/141028/4504262_3.html',
    steps: [
      { no: 1, name: '坐姿屈膝', en: 'Knee Tucks', art: 'mov-legraise-01', view: 'side', std: [[1, 10], [2, 25], [3, 40]] ,
        cue: '坐地双手在身后撑住，屈膝把膝盖收向胸口；别弓腰，也别靠手推。'},
      { no: 2, name: '平卧抬膝', en: 'Flat Knee Raises', art: 'mov-legraise-02', view: 'side', std: [[1, 10], [2, 20], [3, 35]] ,
        cue: '仰卧双手放身侧，屈膝把膝盖抬向胸口、脚离地；腰背贴紧，别拱起。'},
      { no: 3, name: '平卧屈举腿', en: 'Flat Bent Leg Raises', art: 'mov-legraise-03', view: 'side', std: [[1, 10], [2, 15], [3, 30]] ,
        cue: '仰卧膝保持约九十度，大腿抬到垂直、小腿前伸；腰别离地，别用惯性。'},
      { no: 4, name: '平卧蛙举腿', en: 'Flat Frog Raises', art: 'mov-legraise-04', view: 'side', std: [[1, 8], [2, 15], [3, 25]] ,
        cue: '仰卧蛙式，双膝分开、脚跟沿大腿两侧收向臀部；别用腰代偿发力。'},
      { no: 5, name: '平卧直举腿', en: 'Flat Straight Leg Raises', art: 'mov-legraise-05', view: 'side', std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '仰卧双腿并直抬到垂直，慢起慢落；腰背全程贴紧，别甩腿砸地。'},
      { no: 6, name: '悬垂屈膝', en: 'Hanging Knee Raises', art: 'mov-legraise-06', view: 'side', std: [[1, 5], [2, 10], [2, 15]] ,
        cue: '悬挂双手抓杠，屈膝把膝盖收向胸口；腹部主动收，别荡秋千。'},
      { no: 7, name: '悬垂屈举腿', en: 'Hanging Bent Leg Raises', art: 'mov-legraise-07', view: 'side', std: [[1, 5], [2, 10], [2, 15]] ,
        cue: '悬挂屈膝抬到九十度，大腿超过水平、小腿垂着；别耸肩摆荡。'},
      { no: 8, name: '悬垂蛙举腿', en: 'Hanging Frog Raises', art: 'mov-legraise-08', view: 'side', std: [[1, 5], [2, 10], [2, 15]] ,
        cue: '悬挂蛙式，双膝向外分开往上收，再慢放；腹部发力，别靠身体摆动。'},
      { no: 9, name: '悬垂半举腿', en: 'Partial Straight Leg Raises', art: 'mov-legraise-09', view: 'side', std: [[1, 5], [2, 10], [2, 15]] ,
        cue: '悬挂双腿伸直抬到大约水平就停；慢收慢放，别用摆荡借力。'},
      { no: 10, name: '悬垂直举腿', en: 'Hanging Straight Leg Raises', art: 'mov-legraise-10', view: 'side', std: [[1, 5], [2, 10], [2, 30]] ,
        cue: '悬挂双腿伸直举到脚尖接近杠，再控制放下；别甩腿，也别塌腰。'}
    ]
  },
  {
    id: 'bridge', order: 5, name: '桥', en: 'Bridge',
    focus: '后链 · 脊柱', tagline: '肩背先落 · 臀部顶起 · 脊柱逐节展开',
    gear: '不用器械，地面或垫子即可',
    source: 'https://fitness.39.net/qtjs/141028/4504262_4.html',
    steps: [
      { no: 1, name: '短桥', en: 'Short Bridge', art: 'mov-bridge-01', view: 'side', std: [[1, 10], [2, 25], [3, 50]] ,
        cue: '仰卧屈膝、手臂贴地放身侧，只把臀部轻轻顶起；别仰头，头颈放松。'},
      { no: 2, name: '直桥', en: 'Straight Bridge', art: 'mov-bridge-02', view: 'side', std: [[1, 10], [2, 20], [3, 40]] ,
        cue: '双腿伸直、双臂贴地，臀部往高顶、肩背仍贴地；别耸肩，别用腰硬折。'},
      { no: 3, name: '高低桥', en: 'Angled Bridge', art: 'mov-bridge-03', view: 'side', std: [[1, 8], [2, 15], [3, 30]] ,
        cue: '双脚踩在台阶上、肩背着地，臀部顶起让膝高于髋；别把头往后压。'},
      { no: 4, name: '顶桥', en: 'Head Bridge', art: 'mov-bridge-04', view: 'side', std: [[1, 8], [2, 15], [3, 25]] ,
        cue: '脚和头顶撑地，臀部往高顶，双手收在腹上；脖子别硬扛，慢起慢落。'},
      { no: 5, name: '半桥', en: 'Half Bridge', art: 'mov-bridge-05', view: 'side', std: [[1, 8], [2, 15], [3, 20]] ,
        cue: '双手放头两侧、肘尖朝上撑地，髋只顶到半程；别急着把手臂伸直。'},
      { no: 6, name: '标准桥', en: 'Full Bridge', art: 'mov-bridge-06', view: 'side', std: [[1, 6], [2, 10], [2, 15]] ,
        cue: '手脚四点撑地，臀腰顶到最高成拱形，头自然后仰；别只靠腰去折。'},
      { no: 7, name: '下行桥', en: 'Downward Bridge', art: 'mov-bridge-07', view: 'side', std: [[1, 3], [2, 6], [2, 10]] ,
        cue: '背对墙、双手扶墙，屈膝把身体慢慢往下放；动作要慢，别砸下去。'},
      { no: 8, name: '上行桥', en: 'Upward Bridge', art: 'mov-bridge-08', view: 'side', std: [[1, 2], [2, 4], [2, 8]] ,
        cue: '脚踩地、手扶墙，从低位把身体沿墙推高；肩背发力，别只管蹬腿。'},
      { no: 9, name: '合桥', en: 'Closing Bridge', art: 'mov-bridge-09', view: 'side', std: [[1, 1], [2, 3], [2, 6]] ,
        cue: '撑稳桥式后抬起一只手，身体由三点支撑；肩别塌，动作放慢。'},
      { no: 10, name: '铁板桥', en: 'Stand-to-Stand Bridge', art: 'mov-bridge-10', view: 'side', std: [[1, 1], [2, 3], [2, 30]] ,
        cue: '双手双脚踏地，髋顶到最高成拱、全身绷紧；别憋气，也别塌肩。'}
    ]
  },
  {
    id: 'handstand', order: 6, name: '倒立撑', en: 'Handstand Push-Up',
    focus: '肩 · 三头 · 平衡', tagline: '从靠墙开始 · 肘贴身 · 头顶成三角',
    gear: '一面墙',
    source: 'https://fitness.39.net/qtjs/141028/4504262_5.html',
    steps: [
      { no: 1, name: '顶墙倒立', en: 'Wall Headstand', art: 'mov-handstand-01', view: 'side', unit: 'sec', std: [[1, 30], [1, 60], [1, 120]] ,
        cue: '背靠墙、双手撑地，手臂伸直把头夹在两臂之间；肩别耸，别塌腰。'},
      { no: 2, name: '乌鸦式', en: 'Crow Stand', art: 'mov-handstand-02', view: 'side', unit: 'sec', std: [[1, 10], [1, 30], [1, 60]] ,
        cue: '蹲姿双手撑地、屈肘，膝盖顶在上臂上把脚提离地面；别憋气，别塌肩。'},
      { no: 3, name: '靠墙倒立', en: 'Wall Handstand', art: 'mov-handstand-03', view: 'side', unit: 'sec', std: [[1, 30], [1, 60], [1, 120]] ,
        cue: '面对墙手撑地，脚跟贴墙、身体接近垂直；别塌腰，头别往墙里顶。'},
      { no: 4, name: '半倒立撑', en: 'Half Handstand Push-Up', art: 'mov-handstand-04', view: 'side', std: [[1, 5], [2, 10], [3, 20]] ,
        cue: '靠墙倒立，屈肘只下放一半就撑回；肘朝前，别左右晃，别塌腰。'},
      { no: 5, name: '标准倒立撑', en: 'Handstand Push-Up', art: 'mov-handstand-05', view: 'side', std: [[1, 5], [2, 10], [3, 15]] ,
        cue: '靠墙倒立，屈肘下放到头顶轻触地面再撑起；肘贴身，别用脖子借力。'},
      { no: 6, name: '窄距倒立撑', en: 'Close Handstand Push-Up', art: 'mov-handstand-06', view: 'side', std: [[1, 5], [2, 9], [2, 12]] ,
        cue: '双手并拢撑地，其余同标准倒立撑；肘照样外张，别夹肘硬顶手腕。'},
      { no: 7, name: '偏重倒立撑', en: 'Uneven Handstand Push-Up', art: 'mov-handstand-07', view: 'side', perSide: true, std: [[1, 5], [2, 8], [2, 10]] ,
        cue: '重心压在一只手上，另一手略分开只做平衡；别歪髋，两边都要练。'},
      { no: 8, name: '单臂半倒立撑', en: '1/2 One-Arm Handstand Push-Up', art: 'mov-handstand-08', view: 'side', perSide: true, std: [[1, 4], [2, 6], [2, 8]] ,
        cue: '单手撑地只下放一半，另一手抵在后腰；核心收紧，别甩腿歪身。'},
      { no: 9, name: '杠杆倒立撑', en: 'Lever Handstand Push-Up', art: 'mov-handstand-09', view: 'side', perSide: true, std: [[1, 3], [2, 4], [2, 6]] ,
        cue: '单手为主，另一手压球借力做杠杆下放；逐步减小借力，身别歪。'},
      { no: 10, name: '单臂倒立撑', en: 'One-Arm Handstand Push-Up', art: 'mov-handstand-10', view: 'side', perSide: true, std: [[1, 1], [2, 2], [1, 5]] ,
        cue: '单手撑地全幅度下放到头顶触地，另一手背在身后；宁慢勿假。'}
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
