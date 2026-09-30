import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireUser } from "@/lib/server";
import { updateUserAddressesUpdatedAt } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 用户视角：列出当前用户绑定的地址及其收件信息 */
export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    updateUserAddressesUpdatedAt(env, payload.user_id);
    const rows = await env.DB.prepare(
      `SELECT a.id, a.name, a.created_at, a.updated_at,
              (SELECT count(*) FROM raw_mails WHERE address = a.name) as mail_count
       FROM address a
       JOIN users_address ua ON ua.address_id = a.id
       WHERE ua.user_id = ?
       ORDER BY a.created_at DESC`
    )
      .bind(payload.user_id)
      .all();
    return json({ results: rows.results || [] });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}