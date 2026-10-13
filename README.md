# 法语词汇闪卡 · TEF A1–B2 与日常用语

这是 [线上词汇练习网站](https://tef-vocab-practice.geminsim.chatgpt.site/flashcards.html) 的源码备份。首次打开可选中法或英法释义，之后可从页首随时切换。可以按 A1、A2、B1、B2 或独立的“日常与地区用语”词库练习，支持两个练习方向、分类筛选、发音、词典查询、账号切换和复习进度。

> 此仓库**不是纯静态网站**：题目页面和词库数据位于 `public/`，但 ChatGPT 登录、跨设备进度同步依赖服务端 API、Sites 身份信息和 Cloudflare D1 数据库。把 `public/` 直接放到 GitHub Pages，不能保留原有的账号同步功能。推送此仓库也不会自动更新线上 Sites 网站。

## 词库与掌握规则

| 范围 | 说明 | 掌握条件 |
| --- | --- | --- |
| A1–B2 考试库 | 原有分级、阅读、写作与听力词条；“累计”只包含这一库 | A1/A2 连续答对 2 次；B1/B2 连续答对 3 次 |
| 日常与地区用语 | 与考试库分开，包含日常名词、动词、形容词、副词及魁省／法国地区表达 | 连续答对 3 次 |

答错会重置当前词条在当前练习方向的连续正确次数；两个练习方向和两种释义语言分别计数。原有中法记录键不变，英法记录使用独立前缀，因此启用英法不会清除或计入中法的掌握记录。已登录用户的记录通过 `/api/progress` 同步到同一账号。

英法释义覆盖全部 4,897 张卡：英文答案由原中文义项批量翻译，少数容易误译的基础词手工校正。它们是学习辅助译法，不保证覆盖每个法语词的全部义项；多义词、地区口语和固定搭配请结合答题后的词典详解核对。`public/english-data.js` 是已生成文件；`scripts/build-english-cues.mjs` 与 `scripts/fetch-chinese-meanings.ps1` 记录了生成流程，翻译缓存只存于本地 `.sites-runtime/`，不包含在仓库中。

“切换账号”会先同步尚未上传的题目，再通过 Sites 提供的退出入口结束当前网站会话。同步失败时不会退出；重新登录后按新账号读取进度，不会合并两个账号的记录。如果 ChatGPT 登录仍自动选用原账号，需要在 ChatGPT 登录界面切换，或使用另一浏览器会话。

## 本地开发

需要 Node.js **22.13.0 或更新版本**。

```bash
npm ci
npm run dev
```

浏览器打开 `http://localhost:5173/flashcards.html` 或 `http://localhost:5173/reverse.html`。本地运行可查看界面与题库；没有 Sites 提供的登录身份和 D1 绑定时，账号同步不可用。

生产构建与检查：

```bash
npm run build
node test-mastery.mjs
node test-everyday.mjs
node test-keyword-parts.mjs
node test-pronunciation.mjs
node test-language.mjs
```

## 主要目录

- `public/flashcards.html`、`public/reverse.html`、`public/app.js`：两种答题方向及页面逻辑。
- `public/vocab-data.js`、`public/everyday-data.js`、`public/english-data.js`：已生成并纳入版本控制的词库与英文义项数据。
- `public/quiz-core.js`：抽题、选项及掌握判定。
- `app/api/progress/route.ts`、`db/`：账号进度 API 与数据模型。
- `scripts/`：词库整理及构建脚本；日常库再生成步骤见 [`scripts/EVERYDAY-SOURCE.md`](scripts/EVERYDAY-SOURCE.md)。
- `.openai/hosting.json`：现有 Sites 项目标识和 D1 绑定名称；不包含数据库内容或登录密钥。

## 数据来源与使用范围

日常库的开放词典底库改编自 FreeDict/WikDict French–Chinese 2025.11.23（Karl Bartel，**CC BY-SA 3.0 Unported**）。来源、许可、处理方式及地区表达说明见 [`public/everyday-attribution.html`](public/everyday-attribution.html)。请在再分发该改编词库时保留署名和相同方式共享要求。

词库是学习辅助材料，不是官方 TEF 词表；中文释义按卡片所示义项判分，并不覆盖每个词的全部意思。带“口语”“俗语”“粗俗”标签的说法需注意语境，不能直接用于正式写作。
