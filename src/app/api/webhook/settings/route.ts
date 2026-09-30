import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { requireAddress } from "@/lib/server";
import { getBooleanValue } from "@/lib/config";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_WEBHOOK) || !env.KV) return text("未启用 Webhook", 403);
    const settings = await env.KV.get<any>(`${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${payload.address}`, "json");
    return json(settings || { enabled: false, url: "", method: "POST", headers: "{}", body: "" });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { env, payload } = await requireAddress(req);
    if (!getBooleanValue(env.ENABLE_WEBHOOK) || !env.KV) return text("未启用 Webhook", 403);
    const settings = await req.json().catch(() => ({}));
    await env.KV.put(
      `${CONSTANTS.WEBHOOK_KV_USER_SETTINGS_KEY}:${payload.address}`,
      JSON.stringify(settings)
    );
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}