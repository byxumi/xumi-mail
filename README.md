# 临时邮箱 - Next.js × Cloudflare Workers 重构版

基于 [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) 重构的临时邮箱系统。

> 📖 **使用文档**：[USAGE.md](./USAGE.md)（面向使用者的快速上手、收件/发件/账号/兑换码/常见问题）
>
> 🌐 **线上地址**：https://xumi-mail.wanyang3077.workers.dev

**核心变化：** 仅使用**一个 Cloudflare Worker** 即可部署前后端与收信，前后端同构于 **Next.js (App Router)**，数据库用 **Cloudflare D1**。

## 特性

- ✅ **单一 Worker 部署** - Next.js 前端 + API 路由 + `email` 收信处理器全部在一个 Worker 内
- ✅ **完全免费** - 依赖 Cloudflare 免费额度（Workers + D1 + KV + R2）
- ✅ **临时邮箱** - 无需注册即创建邮箱，随机前缀或自定义，多域名
- ✅ **收信解析** - 服务端解析（postal-mime），快速、稳定
- ✅ **验证码提取** - 本地规则引擎（纯正则，邮件不出 Worker），可选 Workers AI 模式
- ✅ **发信** - 支持 Resend / SMTP / SEND_MAIL（Workers Email Routing）
- ✅ **转发 / 自动回复 / Webhook** - 均支持
- ✅ **计划清理** - Cron 自动清理过期邮件与地址
- ✅ **管理后台** - 统计、邮件/地址/用户管理、清理配置
- ✅ **中文本地化** - 面向中文用户的全新界面（Tailwind CSS 设计）

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 15 (App Router, React 19) |
| 部署 | @opennextjs/cloudflare（OpenNext 的 Cloudflare 适配器） |
| 运行时 | Cloudflare Workers (nodejs_compat) |
| 数据库 | Cloudflare D1 (SQLite) |
| 缓存/KV | Cloudflare KV（Webhook 等） |
| 邮件解析 | postal-mime |
| 发信 | resend / worker-mailer / cloudflare:email |
| 收信 | Workers `email` handler（Email Routing） |

## 目录结构

```
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── page.tsx          # 首页（重定向到 /mail）
│   │   ├── mail/             # 收件箱
│   │   ├── send/             # 发件
│   │   ├── account/          # 账号设置（密码/自动回复/Webhook/用户）
│   │   ├── admin/            # 管理后台
│   │   └── api/              # 后端 API 路由（REST）
│   ├── components/           # UI 组件（Header/Toast/通用）
│   ├── hooks/                # React hooks
│   ├── lib/                  # 核心逻辑
│   │   ├── address.ts        # 地址创建/删除/清理
│   │   ├── auth.ts           # JWT 签发/校验
│   │   ├── sendmail.ts       # 发信（Resend/SMTP/SEND_MAIL）
│   │   ├── db.ts             # D1 访问
│   │   └── email/            # 收信管线
│   │       ├── index.ts      # 邮件处理入口
│   │       ├── parse.ts      # postal-mime 解析
│   │       ├── extract_code.ts  # 本地验证码提取
│   │       ├── ai_extract.ts # AI / 本地提取
│   │       ├── forward.ts    # 转发
│   │       ├── auto_reply.ts # 自动回复
│   │       ├── webhook.ts    # Webhook 通知
│   │       └── junk_mail_policy.ts # 垃圾邮件检测
│   └── types/                # 类型定义
├── db/schema.sql             # D1 数据库结构
├── worker.ts                 # 自定义 Worker 入口（email + scheduled）
├── wrangler.jsonc            # Worker 配置
└── next.config.ts            # Next.js 配置（含 Cloudflare dev 集成）
```

## 快速开始

### 1. 创建 Cloudflare 资源

```bash
# 登录
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create cf_temp_mail
# 记录输出的 database_id

# 创建 KV namespace（Webhook 需要）
npx wrangler kv namespace create KV
# 记录输出的 id
```

将上面的 `database_id` 与 KV `id` 填入 `wrangler.jsonc`。

### 2. 初始化数据库

```bash
npx wrangler d1 execute cf_temp_mail --remote --file=db/schema.sql
# 本地开发：
npx wrangler d1 execute cf_temp_mail --local --file=db/schema.sql
```

### 3. 配置变量

编辑 `wrangler.jsonc` 中的 `vars`：

- `DOMAINS` / `DEFAULT_DOMAINS` - **必须**改成你自己的域名（解析到 Cloudflare 的域名）
- `JWT_SECRET` - 改成随机长字符串
- `PREFIX` - 前缀（可选）
- 可选：`PASSWORDS`（站点访问密码）、`ADMIN_PASSWORDS`（管理密码）、`RESEND_TOKEN` / `SMTP_CONFIG`（发信）、`ENABLE_AI_EMAIL_EXTRACT`（AI 提取）

### 4. 收信配置（Email Routing）

1. Cloudflare 后台 → Email → Email Routing → 启用
2. 添加路由规则，把 `*@你的域名` 的邮件转发到 Worker（Actions 里选择 "Send to a Worker"）
3. 选择部署好的 Worker 名（默认 `cf-temp-mail`）

### 5. 部署

```bash
npm run build:worker    # next build + opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

也可以直接用脚本：

```bash
bash scripts/deploy.sh
```

### 本地开发

```bash
npm run dev   # next dev（配合 initOpenNextCloudflareForDev 使用本地 D1）
```

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/settings` | 公开站点设置 |
| POST | `/api/new_address` | 创建临时地址（返回 jwt） |
| GET | `/api/mails` | 收件列表（需要地址 jwt） |
| GET | `/api/mail/:id` | 邮件详情（raw） |
| DELETE | `/api/mail/:id` | 删除邮件 |
| GET | `/api/parsed_mails` | 解析后的邮件列表（subject/sender/text/html） |
| GET | `/api/parsed_mail/:id` | 解析后的邮件详情 |
| DELETE | `/api/address` | 删除地址 |
| DELETE | `/api/clear_inbox` | 清空收件箱 |
| GET | `/api/sendbox` | 发件箱 |
| POST | `/api/send_mail` | 发送邮件 |
| POST | `/api/address_login` | 地址密码登录 |
| POST | `/api/auto_reply` | 保存自动回复 |
| GET/POST | `/api/webhook/settings` | Webhook 设置 |
| POST | `/api/user/register` `/api/user/login` | 用户注册/登录 |
| GET | `/api/admin/statistics` | 管理统计（需 x-admin-auth） |
| GET/POST | `/api/admin/address` | 地址管理 |
| GET/DELETE | `/api/admin/mails` | 邮件管理 |
| GET | `/api/admin/users` | 用户管理 |
| GET/POST | `/api/admin/auto_cleanup` | 自动清理设置 |

## 与上游参考实现的差异

- **架构**：从「前端 Vue + 后端 Hono Worker」双部署改为「Next.js 单一 Worker 部署」（Next API 路由替代 Hono 路由层）
- **前端**：Vue 3 + naive-ui → Next.js/React 19 + Tailwind CSS，全新中文界面
- **数据库**：沿用 D1 同结构（schema 兼容）
- **收信管线**：完整保留（黑名单 → 垃圾检测 → 附件处理 → 存储 → 转发 → AI 提取 → Webhook → 自动回复）
- **未包含**（可自行扩展）：Telegram Bot、S3 附件、Passkey、OAuth2、兑换码等次要功能；核心收件/发件/管理链路完整

## 许可证

MIT（与上游一致）。仅供学习与个人用途，请勿用于违法行为。