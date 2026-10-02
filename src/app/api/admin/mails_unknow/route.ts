import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { resolveRawEmailList } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/mails_unknow?limit&offset —— 未知地址（未绑定）的邮件列表 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const rows = await env.DB.prepare(
      `SELECT * FROM raw_mails WHERE address NOT IN (SELECT name FROM address)
       ORDER BY id DESC LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all<any>();
    const count = ((await env.DB.prepare(
      `SELECT count(*) as c FROM raw_mails WHERE address NOT IN (SELECT name FROM address)`
    ).first("c")) as number) || 0;
    const resolved = await resolveRawEmailList(rows.results);
    return json({ results: resolved, count });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}