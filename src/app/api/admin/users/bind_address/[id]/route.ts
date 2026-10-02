import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/users/bind_address/:id —— 管理员查看某用户绑定的地址（UserAddressManagement.vue）
 *  返回 {results: [{id, name, mail_count, send_count}]}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return text("无效的用户 ID", 400);

    const rows = await env.DB.prepare(
      `SELECT a.id, a.name,
              (SELECT count(*) FROM raw_mails WHERE address = a.name) as mail_count,
              (SELECT count(*) FROM sendbox WHERE address = a.name) as send_count
       FROM address a
       JOIN users_address ua ON ua.address_id = a.id
       WHERE ua.user_id = ?
       ORDER BY a.created_at DESC`
    )
      .bind(id)
      .all<any>();
    return json({ results: rows.results || [] });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}