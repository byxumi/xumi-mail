import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";
import { getDomains } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/user_settings —— 用户设置（UserSettings.vue）
 *  POST /api/admin/user_settings —— 保存
 */
const DEFAULT_USER_SETTINGS = {
  maxAddressCount: 0,
  enableEmailCheckRegex: false,
  emailCheckRegex: "",
  enableMailVerify: false,
  verifyMailSender: "",
  enableAddressCreation: true,
  defaultAddressPrefix: "",
};

export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = (await getJsonSetting<any>(env, CONSTANTS.USER_SETTINGS_KEY)) ?? {};
    return json({ ...DEFAULT_USER_SETTINGS, ...settings });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    // 校验
    const maxAddressCount = Number(body.maxAddressCount);
    if (!Number.isFinite(maxAddressCount) || maxAddressCount < 0) {
      return text("maxAddressCount 必须 >= 0", 400);
    }
    if (body.enableMailVerify && !env.KV) {
      return text("启用邮件验证需要 KV", 403);
    }
    if (body.verifyMailSender) {
      const domains = getDomains(env);
      const senderDomain = String(body.verifyMailSender).split("@").pop() || "";
      if (!domains.some((d) => d === senderDomain)) {
        return text("verifyMailSender 域名需在配置域名内", 400);
      }
    }
    const settings = { ...body };
    await saveSetting(env, CONSTANTS.USER_SETTINGS_KEY, JSON.stringify(settings));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}