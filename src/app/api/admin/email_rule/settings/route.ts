import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 邮件规则设置（未知地址拒收 / 转发规则等） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = await getJsonSetting(env, CONSTANTS.EMAIL_RULE_SETTINGS_KEY);
    return json(settings || { blockReceiveUnknowAddressEmail: false, emailForwardingList: [] });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = await req.json().catch(() => ({}));
    await saveSetting(env, CONSTANTS.EMAIL_RULE_SETTINGS_KEY, JSON.stringify(settings));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}