import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理统计：地址数 / 邮件数 / 今日新增 / 用户数 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const addressCount = ((await env.DB.prepare(`SELECT count(*) as c FROM address`).first("c")) as number) || 0;
    const mailCount = ((await env.DB.prepare(`SELECT count(*) as c FROM raw_mails`).first("c")) as number) || 0;
    const todayMail = ((await env.DB.prepare(
      `SELECT count(*) as c FROM raw_mails WHERE created_at >= datetime('now', 'start of day')`
    ).first("c")) as number) || 0;
    const userCount = ((await env.DB.prepare(`SELECT count(*) as c FROM users`).first("c")) as number) || 0;
    const sentCount = ((await env.DB.prepare(`SELECT count(*) as c FROM sendbox`).first("c")) as number) || 0;
    return json({ address: addressCount, mail: mailCount, todayMail, user: userCount, sent: sentCount });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}