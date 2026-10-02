import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/sendbox?limit&offset&address —— 已发邮件列表（SendBox 组件） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const address = (searchParams.get("address") || "").trim();
    const where = address ? `WHERE address = ?` : "";
    const params = address ? [address] : [];
    const rows = await env.DB.prepare(
      `SELECT * FROM sendbox ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();
    const count =
      ((await env.DB.prepare(`SELECT count(*) as c FROM sendbox ${where}`)
        .bind(...params)
        .first("c")) as number) || 0;
    const results = (rows.results || []).map((row: any) => {
      const raw = typeof row.raw === "string" ? JSON.parse(row.raw || "{}") : row.raw || {};
      return {
        id: row.id,
        address: row.address,
        to_name: raw.to_name,
        to_mail: raw.to_mail,
        subject: raw.subject,
        content: raw.content,
        is_html: raw.is_html,
        created_at: row.created_at,
      };
    });
    return json({ results, count });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}
/** DELETE /api/admin/sendbox?id= —— 删除指定已发邮件（对齐上游 sendbox_api.remove） */
export async function DELETE(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0") || 0;
    if (!id) return text("缺少 id", 400);
    const { success } = await env.DB.prepare(`DELETE FROM sendbox WHERE id = ?`).bind(id).run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}
