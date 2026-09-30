import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";
import { AiExtractSettings } from "@/lib/email/ai_extract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = await getJsonSetting<AiExtractSettings>(env, CONSTANTS.AI_EXTRACT_SETTINGS_KEY);
    return json(settings || { enableAllowList: false, allowList: [] });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = (await req.json().catch(() => ({}))) as AiExtractSettings;
    await saveSetting(env, CONSTANTS.AI_EXTRACT_SETTINGS_KEY, JSON.stringify(settings));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}