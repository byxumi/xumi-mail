import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/webhook/settings —— 管理员 Webhook 全局设置（KV） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    if (!env.KV) return text("未启用 KV", 403);
    const raw = await env.KV.get(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, "json");
    return json(
      raw || {
        enableAllowList: false,
        allowList: [],
      }
    );
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** POST /api/admin/webhook/settings —— 保存管理员 Webhook 全局设置 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    if (!env.KV) return text("未启用 KV", 403);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object") return text("请求体无效", 400);
    const enableAllowList = body.enableAllowList === true;
    const allowList = Array.isArray(body.allowList)
      ? body.allowList.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
      : [];
    await env.KV.put(CONSTANTS.WEBHOOK_KV_SETTINGS_KEY, JSON.stringify({ enableAllowList, allowList }));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}