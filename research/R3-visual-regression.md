# R3 · 截图对比能不能找 UI 瑕疵？（含 Figma 设计稿比对的可行性）

> 起因：同事问"如果有 Figma 设计稿，测试时能不能用截图对比找 UI 瑕疵？"
> 结论先说：**能发现"偏离"，发现不了"设计问题"；而且"跟设计稿逐像素比"是性价比最低的一种用法。**
> 真正高性价比的是**设计令牌断言**（颜色/字号/间距/触达区）与**结构几何比对**，像素比对留给"跟自己的基线比"。

---

## 一、先把问题拆成三件不同的事（混在一起谈必然会失望）

| # | 做什么 | 比对对象 | 噪声 | 性价比 |
|---|---|---|---|---|
| **A. 视觉回归** | 这次改动有没有把界面改坏 | **自己的历史基线** | 低（同环境同设备） | ★★★ 最该先做 |
| **B. 设计稿比对** | 实现和 Figma 差在哪 | Figma 导出的 frame 图 | **极高**（跨渲染栈） | ★ 只当"辅助发现" |
| **C. 设计规范一致性** | 颜色/字号/间距/圆角/触达区是否符合规范 | 设计令牌（tokens） | **零**（数值断言） | ★★★ 最被低估 |

本项目已落地的正是 A 与 C：A = 19 张截图的视觉基线（`e2e/shots.js`），
C = `tests/ui-quality.test.js`（43 组 WCAG 对比度 + 字号下限 + 点按区 ≥88rpx + 禁用纯黑纯灰）。

## 二、开源方案清单（2026，按用途分组）

| 工具 | 定位 | 算法 | 备注 |
|---|---|---|---|
| [pixelmatch](https://github.com/mapbox/pixelmatch) | 像素比对**算法底座** | 逐像素 + 抗锯齿检测 | 下面好几种工具内部都用它 |
| Playwright `toHaveScreenshot()` | E2E 内置视觉断言 | pixelmatch | 零配置、CI 友好；缺交互式报告 |
| [BackstopJS](https://github.com/garris/BackstopJS) | 专门的视觉回归框架 | pixelmatch | **报告最好**：before / after / diff 三视图 + 拖动对比（designer 能看） |
| [reg-cli](https://github.com/reg-viz/reg-cli) + [reg-suit](https://github.com/reg-viz/reg-suit) + [reg-actions](https://github.com/reg-viz/reg-actions) | 纯比对 / 全套 CI | pixelmatch | 基线可存 S3/GCS，PR 里自动贴 diff 报告 |
| [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot) | Jest 生态 | pixelmatch **或 SSIM** | SSIM 模式对渲染噪声更宽容；支持模糊后再比 |
| nightwatch-vrt | Nightwatch 生态 | JIMP | 功能最少，胜在不换框架 |
| [design-compare](https://github.com/TomokiMatsubuchi/design-compare) | **Figma ↔ 实现** 比对（MCP 服务） | 四种模式（见下） | 直接回答"设计稿比对"这个问题 |
| [miniprogram-simulate](https://github.com/wechat-miniprogram/miniprogram-simulate) | 小程序**组件**测试（官方） | jsdom 渲染 + DOM 快照 | ⚠️ **不是像素**：jsdom 不绘制，抓不到颜色/间距/字号 |
| [figma/variables-github-action-example](https://github.com/figma/variables-github-action-example) · [figma-variables-to-style-dictionary](https://www.npmjs.com/package/figma-variables-to-style-dictionary) · [Tokens Studio](https://github.com/tokens-studio) | 把 Figma 变量/tokens 导成代码 | — | C 类（规范一致性）的标准做法 |

> 一句话总结这些工具的共性（也是它们的极限）：**都在比像素，都不懂你的 UI**。
> 它们不知道"按钮右移 2px 是有意改的"，也不知道"按钮从右边跑到左边、但改动像素低于阈值"是重大回归。
> 付费工具（Applitools/Percy/Chromatic 之类）用视觉 AI 缓解这一点，但本质仍是"猜"。

## 三、design-compare 的四种模式（设计稿比对的标准答案）

它把"Figma vs 实现"拆成了四种可分别使用的模式 —— 这个拆法本身比工具更值钱：

| 模式 | 比什么 | 忽略什么 | 用途 |
|---|---|---|---|
| `layout_tree` | Figma 节点树 vs DOM 树的 **BoundingBox 几何**（父子相对比例） | 文字、字体、颜色**全部忽略** | 验"布局骨架/层级/顺序"是否还原 |
| `perceptual` | 图像缩到 16×16 的**明暗指纹**（aHash） | 字体、颜色、文字内容 | 粗粒度"大块布局位置"是否对 |
| `strict` | **逐像素** pixelmatch（默认自动剔除抗锯齿边界） | 只忽略 AA | 微差（颜色/留白/线宽）；**要求两张图像素尺寸完全一致** |
| `layout_integrity` | 只用 **DOM 盒子 vs 视口**（不需要 Figma） | 与设计无关 | 别的宽度下有没有横向溢出/跑出父容器（iPad 竖/横屏） |

> 它的作者还写了两条非常重要的诚实说明：
> ① **`perceptual` 对"整张纯色图"会退化成 100% 匹配** —— 也就是说**截图拍成全黑/全白会"通过"**；
> 工具为此专门加了 `warnings` 提示（"degenerate aHash: image is uniform"）。
> ② `strict` 在两张图尺寸不一致时直接报 `image size mismatch`，需要**同视口 + 同 DPR** 重拍。
> 这两条和我们自己踩到的坑是同一个东西（见下节）。

## 四、我们项目亲手踩过的坑（说明这些"理论限制"有多真）

`e2e/shots.js` 的视觉基线从"每次跑都全变"到"稳定可用"，中间量出三个噪声源：

| 噪声源 | 实测现象 | 处理 |
|---|---|---|
| 状态栏**实时时钟 + 电量** | 同一状态隔 70 秒截两张，整文件哈希必不同（12:17→12:19，还多出 "100"） | 裁掉顶部 48 行 |
| **重启开发者工具后渲染整体位移约 1px** | 标题字形下移 1 行、最大通道差 255，纯哈希报"19 张全变了" | 改"行暗度指纹"（容忍位移） |
| **模拟器几何尺寸会变** | 窗口最小化启动 → 图从 363×785 变 377×813，逐行比对失效 | 比对前先查尺寸，单独提示"不是内容变化" |
| **空白截图** | 一张 10KB 白板被当成 ✓ | 加体积下限 + 空白自动补拍一次 |

阈值也不是拍的：跨会话噪声 0.41%–0.54%、同页面换状态 1.63%、不同页面 54.7% → 取 0.8% 分界。

**换成"跟 Figma 比"，噪声只会更多**：设计稿通常用 Inter/PingFang，真机是系统字体（字形宽度、抗锯齿都不同）；
设计稿画的是 375 宽的某一屏，没有状态栏时钟、没有微信胶囊按钮、没有滚动位置、没有图片加载时序；
更没有空态/加载态/错误态/超长文案/深色模式这些"设计稿里不存在但实现必须处理"的状态。

## 五、结论

1. **能，但别指望"逐像素比对设计稿"**。它适合回答"实现有没有偏离设计"，不适合当验收门禁 ——
   误报率会高到让人放弃（这也是为什么大厂最终都买了视觉 AI 服务或退回人工评审）。
2. **最值钱的不是截图比对，是"把设计规范变成断言"**。Figma 的变量 → tokens JSON → CSS/JS 常量 → 测试断言
   （颜色、字号、行高、间距、圆角、触达区、对比度）。零噪声、能进 CI、能精确定位到某个 token。
   我们项目里的 `ui-quality.test.js` 就是这类（43 组对比度 + 字号 + 点按区），而且是"没有设计稿也能查"的 UI 瑕疵。
3. **像素比对留给"跟自己的基线比"（视觉回归）**，不要拿它跟设计稿比。
4. **必做的四件工程活**（无论用哪个工具）：遮罩动态区（状态栏/胶囊/时间/数字）→ 固定设备与 DPR → 空白图守卫 →
   diff 必须有人看过才允许更新基线。缺一个，这套东西两周内就会被团队放弃。

### 推荐的分层落地顺序（对"类似小程序项目"）

| 层 | 做什么 | 成本 | 能抓到什么 |
|---|---|---|---|
| **L1** | 设计令牌断言（颜色/字号/间距/圆角/触达区/对比度） | 半天–1 天 | 大部分"UI 瑕疵"：字号过小、对比度不足、点不到的按钮、间距不合规范 |
| **L2** | 结构几何比对（design-compare 的 `layout_tree`：Figma 节点 ↔ DOM 选择器） | 1–2 天 | 布局骨架/层级/顺序还原错误 —— **比像素稳得多，还能定位到具体元素** |
| **L3** | 感知哈希（`perceptual`） | 半天 | 大块布局跑偏（粗粒度哨兵） |
| **L4** | 严格像素（`strict`）**只对自己的基线** | 我们的基线 1 天可复用 | 意外改动（间距/颜色/字重被改坏） |
| **L5** | 人看图（真机 + 设计稿并排） | 每次 10 分钟 | 设计意图、视觉重量、层级、可用性 —— **永远无法自动化** |
| — | 额外：`layout_integrity` 式检查（别的宽度会不会溢出） | 半天 | 平板/大屏下的横向溢出（设计稿只画了一个宽度） |

### 小程序场景的两个额外约束

- **截图必须在开发者工具（或真机）里跑**：`miniprogram-automator` 的 `mp.screenshot()` 是当前唯一稳定路径，
  所以视觉测试**进不了 GitHub 托管 CI**（我们就是这么处理的：CI 只跑 Node 层断言，截图在本地 pass）。
  要进 CI 得自建 runner 或接厂商云测。
- **`miniprogram-simulate` 不是像素测试**：它在 jsdom 里跑组件、能做 DOM 快照，
  抓得到"结构变了"，抓不到"颜色/字号/间距变了"。别把它当视觉测试用。
- 想要"全页"截图：`wx.pageScrollTo` + 等 0.2 秒即可（我们实测过，以前"滚动截图必白"的结论是错的 —— 那是滚完立刻截）。

## 六、如果要做，我的建议顺序

1. 先做 **L1**（设计令牌断言）—— 投入最小、收益最大，而且不依赖任何截图工具；
2. 再做 **L4**（复用自己的基线）—— 我们已经有 19 张图 + 指纹比对 + 空白补拍 + 几何守卫，直接抄；
3. 然后做 **L2**（Figma 结构比对）—— 需要 Figma 文件的节点几何（REST API 或 Dev Mode 导出），
   比像素值钱得多（**但要比锚点、不要比树，见第八节**）；
4. **L3/L5 按需**；`strict` 与设计稿的逐像素比对**不要做**（当门禁）。

> 相关：本项目的实践细节见 `TESTING.md` 第六节之二（视觉回归基线）与 `TESTING-REPORT.html` 第 4 节「坑 C」。

---

## 七、修正一：不是"不用设计稿对比"，而是"别拿像素比对当门禁"

第五节说"逐像素比设计稿不要做"，容易被读成"设计稿对比没用"。**更准确的说法是**：

> 设计稿对比**值得做**，但要把它从"像素 diff"**降级成"规范 + 几何断言"**；像素 diff 只当提示，不当门禁。

| 形态 | 比什么 | 噪声 | 定位 |
|---|---|---|---|
| ① **规范**（tokens） | 颜色 / 字号 / 行高 / 间距 / 圆角 / 触达区 | **零** | **门禁**（CI 能拦） |
| ② **几何**（锚点元素） | 关键元素相对父级的位置/尺寸比例、对齐、间距、视觉顺序 | 低（数值 + 容差） | **门禁**（能拦，且能定位到元素） |
| ③ **像素** | 截图对截图 | 高 | **提示**（人看，不拦） |

**时机**：设计稿对比属于**设计走查**（每次迭代做一次、人工主导），不是"每次提交都跑的门禁"。
把它做成门禁的结果，一定是团队两周内把它关掉。

## 八、修正二：结构会变，所以要比"锚点"而不是比"树"

"实现过程中组件和页面结构会发生变化"——这条完全成立，而且**正是"树形结构比对"会死掉的原因**：

- Figma 的图层树（Frame/Group/Auto-layout）与 DOM/WXML 的组件树**本来就不是一回事**；
- 实现过程中拆组件、加 wrapper、换 `<view>` 层级，**视觉完全没变、树却全变了**；
- 树形 diff 会把"重构"报成"回归" —— 这就是误报的来源。

**正确做法：锚点（design anchor）**，比"锚点对"的几何，不比"树的形状"：

```
Figma 侧                               代码侧                                     比对内容
layer "home/main-card"          ←→    data-design="home.main-card"              相对父级的 x/y/w/h 比例
layer "home/main-card/title"    ←→    data-design="home.main-card.title"        + 间距 / 对齐 / 字号
layer "home/main-card/cta"      ←→    data-design="home.main-card.cta"          + 视觉顺序（锚点序列）
```

落地要点：

1. **锚点写在代码里**：小程序 WXML 支持自定义 `data-*`（也可用稳定 class）；
   取几何用 `wx.createSelectorQuery().select(...).boundingClientRect()`，
   E2E 里也能走 automator 的元素 `boundingClientRect()`。
2. **锚点映射表单独维护**（例如 `design-anchors.json`：Figma 图层名 ↔ 代码锚点）——
   **重构时结构变了、映射不变 → 断言不炸**；只有"设计意图变了"（间距/尺寸/顺序）才红。
3. 比的是**相对几何 + 不变量**，不是绝对像素：
   `卡片内边距 = 父宽 × (24/375) ± 2px`、`主按钮高度 ≥ 88rpx`、`标题在卡片左上、间距 12rpx ±2`。
4. **视觉顺序**用"锚点序列"表达（`[卡片, 标题, 标准行, 按钮]`）——
   顺序错位是真实回归，但用序列而不是 DOM 树表达，就不怕包一层 wrapper。
5. 判据一句话：**视觉测试只该对"视觉变化"报警**。锚点法天然做到（重构不报警），树形法天然做不到。
6. 附带好处：失败信息能直接说"`home.main-card` 内边距是 28、设计稿是 24"，
   比"第 437 行有 1.2% 像素不同"有用得多。

> 结论：**结构会变 → 所以更不能比树。** 用锚点把"设计意图"从"实现结构"里解耦，
> 这是"设计稿对比"能长期活下去的前提。

## 九、BackstopJS 的原理（以及它为什么是这类工具里报告最好的）

一句话：**配置驱动的"截图 → 比对 → 报告"CLI 框架**；渲染用 Chrome Headless（Puppeteer 或 Playwright），
比对用 [Resemble.js](https://github.com/Huddle/Resemble.js)。

### 1. 三条命令 = 一个基线流转环

```
backstop reference  ──截图──>  backstop_data/bitmaps_reference/      （基线，入库）
backstop test       ──截图──>  backstop_data/bitmaps_test/<时间戳>/   （本次结果）
                               └─ 与 reference 逐张比对
                                  ├─> html_report/  浏览器报告：参考/本次/差异三视图 + 拖动对比
                                  ├─> ci_report/    CI 用的 JUnit 报告
                                  └─> 退出码 0 / 1
backstop approve    ──把 test 提升为 reference（= "人看过图、认可了"这个动作）──> bitmaps_reference/
```

**`approve` 是它最值钱的设计**：报告里能拖动对比，看完一条命令固化新基线 ——
它把"人必须看图"变成流程里的显式步骤，而不是一句口头约定。（我们项目的 `--update-baseline` 是同一个思路。）

### 2. 一个 scenario 的执行流水线（属性按官方顺序生效）

```
label → onBeforeScript（设 cookie/state）→ goto url（或 referenceUrl）
      → 等就绪：readyEvent（console.log 标记）/ readySelector / readyTimeout（默认 30s）
      → delay（固定等待）
      → 处理动态区：hideSelectors（visibility:hidden，**保留布局占位**）
                    removeSelectors（从 DOM 删掉，**会改变布局**）
      → onReadyScript（click / hover / keyPress / scrollToSelector / postInteractionWait）
      → 截图 selectors：document（整页）/ viewport（视口）/ CSS 选择器
                        （selectorExpansion 展开全部，expect 校验数量）
      → 落盘 PNG（文件名模板 {scenarioLabel}_{selectorLabel}_{viewportLabel}）
      → 与 reference 比对（Resemble.js）→ 报告 + 退出码
```

### 3. 比对这一步的关键参数（也是坑的清单）

| 参数 | 默认 | 含义 / 坑 |
|---|---|---|
| `misMatchThreshold` | **0.1%** | 允许的差异像素占比。**Resemble 的 misMatchPercentage 只检测 0.01% 以上的差异** —— 要比更细需开 `usePreciseMatching` |
| `requireSameDimensions` | **true** | 尺寸变了直接失败。**这就是"设备 / DPR 必须一致"的硬约束**（我们在小程序侧踩的是同一个坑：363×785 → 377×813） |
| `resembleOutputOptions.ignoreAntialiasing` | false | 忽略抗锯齿边缘差异 —— 治"字体渲染不同"的噪声 |
| `resembleOutputOptions.errorType` | — | 可设 `movement`（对位移更敏感），比纯色差更接近"元素跑了" |
| `asyncCaptureLimit` / `asyncCompareLimit` | 10 / 50 | 并行度，按内存调 |
| `engine` | `puppeteer` | 可换 `playwright`（chromium/firefox/webkit）；`engineOptions.storageState` 可带登录态 |

### 4. 它专为"噪声"准备的两个开关（值得抄的工程思路）

- `hideSelectors`（`visibility:hidden`，**保留布局**）vs `removeSelectors`（**从 DOM 移除**，会改布局）：
  时间/头像/广告位这类动态内容用前者；"完全不参与、也不在乎布局变化"的用后者。
- `backstop test --docker`：官方 README 直接贴了"同一页面在 Linux 与 Mac 上字体渲染不同"的对比图，
  用容器把渲染环境钉死 —— **跨环境一致性的正解，而不是调阈值**。

### 5. 诚实评价

- **强**：报告最好（三视图 + 拖动 + 直接 approve）、`--filter` 只重跑失败的、可 `require('backstopjs')`
  嵌进 Node 脚本、支持交互（click/hover/keypress/scroll）后再截图。
- **弱**：像素比对无语义（按钮左右互换但像素差低于阈值 → 静默通过）；基线入库会膨胀
  （官方建议 `.gitignore` 掉 `html_report/` 与 `bitmaps_test/`）；approve 流程要跑本地 server；
  只吃 **URL**，所以**小程序本体喂不进去**。
- ⚠️ **维护风险**：官方 README 顶部现在写着「**BackstopJS needs a new maintainer/owner**」——
  选它就要接受"可能停止维护"；长期支持上 Playwright 内置的 `toHaveScreenshot()` 更稳。
- **与本项目的关系**：我们有 `preview/index.html`（同一份 `arts.js` / `progress.js` 注入的网页预览），
  所以"用 BackstopJS 测网页预览"可行（但要诚实标注：测的是网页版，不是小程序本体）。
  另外 `e2e/shots.js` + 指纹本质就是一个"迷你 BackstopJS"，差别在于：
  **我们直接驱动小程序运行时（更真），但报告能力弱（没有三视图、没有 approve 流程）。**
