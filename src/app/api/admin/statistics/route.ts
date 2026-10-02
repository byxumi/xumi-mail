import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理统计：地址数 / 邮件数 / 活跃地址 / 发送数 / 用户数 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const addressCount = ((await env.DB.prepare(`SELECT count(*) as c FROM address`).first("c")) as number) || 0;
    const mailCount = ((await env.DB.prepare(`SELECT count(*) as c FROM raw_mails`).first("c")) as number) || 0;
    const activeAddressCount7days = ((await env.DB.prepare(
      `SELECT count(*) as c FROM address WHERE updated_at >= datetime('now', '-7 day')`
    ).first("c")) as number) || 0;
    const activeAddressCount30days = ((await env.DB.prepare(
      `SELECT count(*) as c FROM address WHERE updated_at >= datetime('now', '-30 day')`
    ).first("c")) as number) || 0;
    const sendMailCount = ((await env.DB.prepare(`SELECT count(*) as c FROM sendbox`).first("c")) as number) || 0;
    const userCount = ((await env.DB.prepare(`SELECT count(*) as c FROM users`).first("c")) as number) || 0;
    return json({ addressCount, mailCount, activeAddressCount7days, activeAddressCount30days, sendMailCount, userCount });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}