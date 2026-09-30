# 部署指南（GitHub Actions 云端部署）

> 本机（Android proot）环境下 `next build` 会因容器的 mmap 限制崩溃（tcmalloc 1GB 对齐映射失败），
> 因此推荐使用 **GitHub Actions 在云端完成构建 + 部署**。任何正常电脑也可本地构建。

## 已为你准备好的资源（全新，未覆盖任何现有部署）

| 资源 | 名称 | ID |
|---|---|---|
| Worker | `xumi-mail`（全新，尚未创建，由 CI 创建） | - |
| D1 数据库 | `xumi-mail-db` | `f214beb5-7987-4260-b44b-3b3a1c80bd2c` |
| KV 命名空间 | `xumi-mail-kv` | `87a0ca5d87a849f18ed2252e9adc0cdd` |

- 账号下现有的 18 个 Worker（含 `cloudflare_temp_email`、`xumimail-api` 等）**均未改动**
- D1 表结构已通过 `db/schema.sql` 初始化（address / raw_mails / users 等 11 张表）

## 第一步：推送代码到 GitHub

```bash
# 在项目目录（/root/workspace/xumi mail）
git remote add origin https://github.com/<你的用户名>/xumi-mail.git
git push -u origin main
```

## 第二步：配置 GitHub Secrets

进入 GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret 名称 | 值 |
|---|---|
| `CF_API_TOKEN` | `lFASpwghqvdNn4bN7HcwzS1MseQZ-iaHtnrBQ8DI` |
| `CF_ACCOUNT_ID` | `fc44973bd5f8b9ccf125248c3159d65d` |

> 提示：该 token 已在对话中可见。若担心泄露，建议在 Cloudflare 后台**重新生成一个相同权限的 token** 再填入（权限需含：Workers Scripts 编辑、D1 编辑、KV 编辑）。

## 第三步：触发部署

推送 `main` 分支后自动触发，或手动运行：
GitHub 仓库 → **Actions → Deploy xumi-mail to Cloudflare Workers → Run workflow**

工作流会自动完成：
1. `npm ci` 安装依赖
2. `npm run typecheck` 类型检查
3. `npm test` 单元 + 集成测试（47 个断言）
4. `wrangler d1 execute` 幂等初始化 D1 表
5. `npm run build:worker`（next build + OpenNext 打包）
6. `wrangler deploy` 部署全新 Worker `xumi-mail`

## 第四步：配置 Email Routing 收信（需要你在后台手动完成）

API token 没有 DNS / Email Routing 权限，请到 Cloudflare 后台：

1. 打开 **Cloudflare Dashboard → Your Account → Email → Email Routing**
2. 对域名 `xumimail.click` 和 `xumimail.help` 分别启用 Email Routing（会自动添加 MX 记录）
3. 新增路由规则：**Action → Send to a Worker → 选择 `xumi-mail`**
   - 规则匹配：`*@xumimail.click` 和 `*@xumimail.help`（或按需的 catch-all）
4. 部署完成后 Worker 会收到投递的邮件并解析存储

> 发信（SEND_MAIL / Resend）需要额外配置 `RESEND_TOKEN` 或 `SMTP_CONFIG` 变量，收信无需。

## 验证

部署完成后访问 Worker 域名（`https://xumi-mail.<你的账户子域>.workers.dev`），应看到中文界面：

1. 点击「创建邮箱地址」→ 得到 `临时前缀@xumimail.click`
2. 向该地址发一封测试邮件 → 15 秒内出现在收件箱
3. 管理后台：`/admin`，密码是 `wrangler.jsonc` 中 `ADMIN_PASSWORDS`（默认未配置 = 开放，建议部署后加上）

## 本地部署（可选，任意正常电脑）

```bash
npm install
npm run build:worker
npx wrangler deploy
```

## 注意事项

- Worker 名称 `xumi-mail` 与账号内现有 Worker 都不冲突（已核对 18 个现有名称）
- D1 / KV 均为新建，不会影响 `cloudflare_temp_email` 等旧服务
- 定时清理默认每小时触发（`crons: ["0 * * * *"]`），可通过管理后台配置清理策略