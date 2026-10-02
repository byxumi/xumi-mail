import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireUser } from "@/lib/server";
import { resolveRawEmailList } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 用户视角：查看绑定地址的邮件 */
export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
    if (!address) return text("缺少 address", 400);

    // 校验该地址属于当前用户
    const bound = await env.DB.prepare(
      `SELECT ua.address_id FROM users_address ua JOIN address a ON a.id = ua.address_id
       WHERE ua.user_id = ? AND a.name = ?`
    )
      .bind(payload.user_id, address)
      .first();
    if (!bound) return text("该地址未绑定到当前用户", 403);

    const dbResult = await env.DB.prepare(
      `SELECT * FROM raw_mails where address = ? order by id desc limit ? offset ?`
    )
      .bind(address, limit, offset)
      .all();
    const countRow = await env.DB.prepare(`SELECT count(*) as count FROM raw_mails WHERE address = ?`)
      .bind(address)
      .first<number>("count");
    const resolved = await resolveRawEmailList(dbResult.results as any[]);
    return json({ results: resolved, count: countRow || 0 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}