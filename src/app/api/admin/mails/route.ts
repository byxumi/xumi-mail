import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { resolveRawEmailList } from "@/lib/gzip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理：所有邮件列表 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100);
    const offset = parseInt(searchParams.get("offset") || "0") || 0;
    const address = searchParams.get("address") || "";

    let query = `SELECT * FROM raw_mails`;
    const params: unknown[] = [];
    if (address) {
      query += ` WHERE address = ?`;
      params.push(address);
    }
    query += ` order by id desc limit ? offset ?`;
    params.push(limit, offset);
    const { results } = await env.DB.prepare(query).bind(...params).all();
    const resolved = await resolveRawEmailList(results as any[]);
    return json({ results: resolved, count: resolved.length });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as { id?: number };
    const { id } = body;
    if (!id) return text("缺少 id", 400);
    const { success } = await env.DB.prepare(`DELETE FROM raw_mails WHERE id = ?`).bind(id).run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}