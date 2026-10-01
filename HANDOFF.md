# 📦 Xumi Mail 项目交接文档

> 最后更新：2026-10-01 · 状态：**已上线运行中**
> 在线地址：**https://xumi-mail.wanyang3077.workers.dev**

---

## 1. 项目一句话

基于 `cloudflare_temp_email` 重构的**临时邮箱系统**：Next.js 15 前后端一体，部署为**单个 Cloudflare Worker**（HTTP 前端 + API + Email 收信处理器），数据存 D1，零成本运行。

---

## 2. 已部署资源清单（Cloudflare）

| 资源 | 名称 | ID / 说明 |
|---|---|---|
| **Worker** | `xumi-mail` | 线上运行中，含前端 + API + email handler + cron |
| **D1 数据库** | `xumi-mail-db` | `f214beb5-7987-4260-b44b-3b3a1c80bd2c`，11 张表已建好 |
| **KV 命名空间** | `xumi-mail-kv` | `87a0ca5d87a849f18ed2252e9adc0cdd`（Webhook 等用） |
| **域名（收信）** | `xumimail.click` / `xumimail.help` | zone 均在账号下，**Email Routing 待配置**（见 §7） |

> 账号下原有的 18 个 Worker（`cloudflare_temp_email`、`xumimail-api` 等）**均未改动**，本项目的 `xumi-mail` 是全新资源，互不干扰。

### Cloudflare 账号信息

- 账号 ID：`fc44973bd5f8b9ccf125248c3159d65d`
- API Token：`lFASpwghqvdNn4bN7HcwzS1MseQZ-iaHtnrBQ8DI`（⚠️ 已用于 CI Secrets，**建议尽快在 Cloudflare 后台轮换**，并同步更新 GitHub Secrets）

---

## 3. GitHub 仓库

- 仓库：**https://github.com/byxumi/xumi-mail**（公开）
- 分支：`main`
- 部署方式：push `main` 自动触发 GitHub Actions 构建部署

### GitHub Actions Secrets（已配置）

| Secret | 值 |
|---|---|
| `CF_API_TOKEN` | Cloudflare API Token（见上） |
| `CF_ACCOUNT_ID` | `fc44973bd5f8b9ccf125248c3159d65d` |

---

## 4. 技术架构

```
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Worker: xumi-mail               │
│                                                          │
│  worker.ts (自定义入口)                                   │
│  ├── fetch  ←── .open-next/worker.js (OpenNext 生成的     │
│  │               Next.js 运行时：页面 + /api/* Route)     │
│  ├── email  ←── Email Routing 投递的邮件 → 收信管线        │
│  └── scheduled ←── cron 每小时 → 自动清理                 │
│                                                          │
│  绑定：D1 (DB) · KV · ASSETS (静态资源)                   │
└─────────────────────────────────────────────────────────┘
```

**关键组件：**

| 模块 | 位置 | 说明 |
|---|---|---|
| 收信管线 | `src/lib/email/index.ts` | 黑名单 → 垃圾检测 → 附件处理 → 存储 → 转发 → AI 提取 → Webhook → 自动回复 |
| 验证码提取 | `src/lib/email/extract_code.ts` | 纯正则本地规则（移植上游），邮件不出 Worker |
| 发信 | `src/lib/sendmail.ts` | Resend / SMTP(worker-mailer) / SEND_MAIL 三种方式 + 余额 |
| 地址管理 | `src/lib/address.ts` | 创建/删除/清理（前缀、域名校验、随机子域） |
| 鉴权 | `src/lib/auth.ts` | JWT（jose, HS256）地址 token + 用户 token |
| 前端 | `src/app/` | iOS 苹果风 UI（毛玻璃、分组卡片、深色模式） |

---

## 5. 代码结构

```
src/
├── app/                        # Next.js App Router
│   ├── page.tsx                # 落地页（苹果风 hero）
│   ├── mail/                   # 收件箱（列表+详情+验证码高亮+地址登录）
│   ├── send/                   # 发件
│   ├── account/                # 账号（密码/自动回复/Webhook/用户）
│   ├── admin/                  # 管理后台（统计/邮件/地址/用户/清理）
│   └── api/                    # 后端 API（30+ 路由）
├── components/                 # Header(毛玻璃) / Toast / ui(控件库)
├── hooks/                      # useSettings / useTheme
├── lib/
│   ├── client.ts               # 前端 API 封装
│   ├── server.ts               # 服务端 API 辅助
│   ├── email/                  # 收信管线各模块
│   ├── address.ts / auth.ts / sendmail.ts / db.ts / config.ts / gzip.ts
│   └── constants.ts / types/
├── db/schema.sql               # D1 表结构（幂等）
├── worker.ts                   # Worker 自定义入口（email+scheduled）
├── scripts/
│   ├── patch-opennext.mjs      # ⚠️ 关键：OpenNext esbuild 补丁（见 §8）
│   ├── smoke-test.ts           # 核心逻辑测试（27 项）
│   └── integration-test.ts     # 集成测试（20 项，D1 mock）
└── wrangler.jsonc              # Worker 配置（绑定 D1/KV/域名）
```

---

## 6. 本地开发与部署

### 本地开发（任意正常电脑）

```bash
npm install
npm run dev          # next dev（配合 initOpenNextCloudflareForDev 本地 D1）
```

### 本地构建部署（本机需非 proot 环境，或 CI）

```bash
npm run typecheck    # 类型检查
npm test             # 47 项测试（smoke + integration）
npm run build:worker # 先打补丁，再 OpenNext 构建（输出 .open-next/）
npx wrangler deploy  # 部署（读取 wrangler.jsonc）
```

### CI 自动部署（当前实际使用）

push `main` → Actions 自动执行：
`npm ci` → typecheck → test → D1 初始化（幂等）→ next build → opennextjs-cloudflare build → wrangler deploy

---

## 7. ⚠️ 待办事项（需要人工处理）

### ① 配置 Email Routing（收信功能的关键！）

Worker 的 **HTTP 访问已全部正常**，但**收信还没通**，因为 API Token 无 Email Routing 权限，需要到后台手动：

1. Cloudflare Dashboard → **Email → Email Routing**
2. 对 `xumimail.click` 启用（会自动添加 MX 记录），`xumimail.help` 同理
3. 添加路由规则：
   - 匹配 `*@xumimail.click` → **Action: Send to a Worker** → 选择 `xumi-mail`
   - 匹配 `*@xumimail.help` → 同上
4. 完成后向任意 `tmpxxx@xumimail.click` 发信，15 秒内出现在收件箱

### ② 建议配置发信（可选）

要发信需在 `wrangler.jsonc` `vars` 或 Cloudflare 后台添加：
- `RESEND_TOKEN`（Resend 方式），或
- `SMTP_CONFIG`（SMTP 方式，用 worker-mailer），或
- `SEND_MAIL` binding（Workers Email Routing 发信）

### ③ 轮换 API Token

本项目使用的 CF API Token 已在多个地方暴露，建议尽快在 Cloudflare 后台**重新生成**（权限：Workers Scripts 编辑、D1 编辑、KV 编辑），并更新 GitHub Secrets 中的 `CF_API_TOKEN`。

### ④ 管理后台加密码

当前 `wrangler.jsonc` 未配置 `ADMIN_PASSWORDS`（管理后台默认开放）。上线正式使用前建议加上：
```jsonc
"ADMIN_PASSWORDS": ["你的强密码"],
"PASSWORDS": ["站点访问密码"],   // 可选：整个站点加访问控制
```

---

## 8. ⚠️ 已知技术要点（维护必读）

### OpenNext + `cloudflare:` 模块补丁

`cloudflare:email` / `cloudflare:sockets` 是 Workers 运行时内置模块，webpack 和 OpenNext 的 esbuild 都无法解析。**`scripts/patch-opennext.mjs`** 在构建前给 `@opennextjs/cloudflare` 的 bundle-server 注入 esbuild 插件，把它们标记为 external（由 workerd 运行时解析）。

- 必须通过 `npm run build:worker` 构建（先打补丁）
- CI 的 Build Worker 步骤用的是 `npm run build:worker`（不要改回裸 `npx opennextjs-cloudflare build`）
- patch 幂等：已注入则跳过

### 本机（Android proot）无法构建

本容器 `next build` 会因 proot 的 mmap 限制崩溃（Node tcmalloc 1GB 对齐 mmap 失败），**与代码无关**，任意正常 Linux/macOS/CI 均可构建。因此部署一律走 GitHub Actions。

### 项目内注意事项

- `src/lib/client.ts` 的 `tokenStore` 必须保留 `typeof window` 守卫（SSR 安全）
- API 路由禁止导出非标准字段（如 `export { CONSTANTS }`），Next.js 会报错
- `cloudflare:email` 动态 import 必须用**变量形式**（`const name = "cloudflare:email"; await import(name)`），字面量会被 esbuild 静态解析报错

---

## 9. 功能清单（当前已实现）

| 功能 | 状态 |
|---|---|
| 创建临时地址（随机/自定义前缀、多域名、随机子域） | ✅ |
| 收件 + 解析（主题/正文/附件/发件人） | ✅ |
| 验证码自动提取（本地规则，支持中英日韩多语言） | ✅ |
| 未读标记 + 自动刷新（15s） | ✅ |
| 地址密码登录（前端 SHA-256） | ✅ |
| 发件（Resend/SMTP/SEND_MAIL） | ✅（需先配置发信） |
| 自动回复 | ✅ |
| Webhook 通知 | ✅ |
| 用户注册/登录/绑定地址 | ✅ |
| 管理后台（统计/邮件/地址/用户/清理配置） | ✅ |
| cron 自动清理 | ✅（每小时） |
| 垃圾邮件检测（SPF/DKIM/DMARC） | ✅（需开启 `ENABLE_CHECK_JUNK_MAIL`） |
| 邮件转发 / AI 提取（Workers AI） | ✅（需配置对应变量） |
| 附件下载 | ⏳（附件仅展示，S3 存储未接入） |
| Telegram Bot 推送 | ⏳（上游功能，未移植） |
| 兑换码 / Passkey / OAuth2 | ⏳（上游功能，未移植） |

---

## 10. 常用命令速查

```bash
# 测试与检查
npm run typecheck          # TypeScript 类型检查
npm test                   # 全部测试（47 项）

# 数据库（本地/远程）
npx wrangler d1 execute xumi-mail-db --remote --file=db/schema.sql
npx wrangler d1 execute xumi-mail-db --remote --command "SELECT count(*) FROM raw_mails;"

# 部署
npm run build:worker && npx wrangler deploy

# 查看 Worker 状态
npx wrangler deployments list
```

---

## 11. 联系方式与凭据速查

| 项 | 值 |
|---|---|
| GitHub 用户 | `byxumi` |
| GitHub Token | `ghp_...`（在用户提供处，未在本仓库提交） |
| Cloudflare 账号 | `wanyang3077@gmail.com` |
| 在线地址 | https://xumi-mail.wanyang3077.workers.dev |
| 参考上游 | https://github.com/dreamhunter2333/cloudflare_temp_email |

> 🔐 安全提醒：本文档内涉及的 token 若已泄露或交接给他人后，请立即在对应平台轮换。
