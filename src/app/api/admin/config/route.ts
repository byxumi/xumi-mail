import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 管理员通用 JSON 配置读取（key 通过查询参数传入） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return text("缺少 key", 400);
    const value = await getJsonSetting(env, key);
    return json({ key, value });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 管理员通用 JSON 配置保存 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
    if (!key) return text("缺少 key", 400);
    await saveSetting(env, key, typeof value === "string" ? value : JSON.stringify(value));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}