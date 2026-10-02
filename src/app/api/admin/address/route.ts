import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, clientIp } from "@/lib/server";
import { newAddress, deleteAddressWithData } from "@/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理：地址列表 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 200);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const query = searchParams.get("query") || "";
    let sql = `SELECT a.*,
                   (SELECT count(*) FROM raw_mails WHERE address = a.name) as mail_count,
                   (SELECT count(*) FROM sendbox WHERE address = a.name) as send_count
            FROM address a`;
    const params: unknown[] = [];
    if (query) {
      sql += ` WHERE a.name LIKE ?`;
      params.push(`%${query}%`);
    }
    sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    const countRow = await env.DB.prepare(
      query ? `SELECT count(*) as cnt FROM address WHERE name LIKE ?` : `SELECT count(*) as cnt FROM address`
    )
      .bind(...(query ? [`%${query}%`] : []))
      .first();
    return json({ results, count: (countRow as any)?.cnt ?? results.length });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 管理：创建地址 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as { name?: string; domain?: string };
    const { name, domain } = body;
    const res = await newAddress(env, {
      name: String(name || ""),
      domain: domain || null,
      enablePrefix: false,
      enableCheckNameRegex: false,
      sourceMeta: `admin:${clientIp(req)}`,
    });
    return json(res);
  } catch (e) {
    return text(`创建失败: ${(e as Error).message}`, 400);
  }
}

/** 管理：删除地址 */
export async function DELETE(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0");
    if (!id) return text("缺少 id", 400);
    const success = await deleteAddressWithData(env, null, id);
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}