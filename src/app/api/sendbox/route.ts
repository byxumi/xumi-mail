import { NextRequest } from "next/server";
import { json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { handleListQuery } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";
    const offset = searchParams.get("offset") || "0";
    const result = await handleListQuery(
      env,
      `SELECT * FROM sendbox where address = ?`,
      `SELECT count(*) as count FROM sendbox where address = ?`,
      [payload.address],
      limit,
      offset
    );
    if ("error" in result) return text(result.error, result.status);
    return json(result);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return text("缺少 id", 400);
    if (!getBooleanValue(env.ENABLE_USER_DELETE_EMAIL)) return text("已禁用删除邮件", 403);
    const { success } = await env.DB.prepare(`DELETE FROM sendbox WHERE address = ? and id = ?`)
      .bind(payload.address, id)
      .run();
    return json({ success });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}