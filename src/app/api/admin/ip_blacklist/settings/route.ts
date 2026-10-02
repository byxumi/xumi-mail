import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_IP_BLACKLIST_SETTINGS = {
  enabled: false,
  blacklist: [],
  asnBlacklist: [],
  fingerprintBlacklist: [],
  enableWhitelist: false,
  whitelist: [],
  enableDailyLimit: false,
  dailyRequestLimit: 1000,
};

const MAX_BLACKLIST_SIZE = 1000;

function sanitizeList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

/** GET /api/admin/ip_blacklist/settings —— IP 黑名单设置 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings =
      (await getJsonSetting<any>(env, CONSTANTS.IP_BLACKLIST_SETTINGS_KEY)) || DEFAULT_IP_BLACKLIST_SETTINGS;
    return json(settings);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** POST /api/admin/ip_blacklist/settings —— 保存 IP 黑名单设置 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = await readJson(req);
    if (!body || typeof body !== "object") return text("请求体无效", 400);
    const b = body as any;
    // 类型校验
    for (const key of ["enabled", "enableWhitelist", "enableDailyLimit"]) {
      if (b[key] !== undefined && typeof b[key] !== "boolean") return text(`字段 ${key} 必须为布尔值`, 400);
    }
    if (
      b.dailyRequestLimit !== undefined &&
      (typeof b.dailyRequestLimit !== "number" || b.dailyRequestLimit < 1 || b.dailyRequestLimit > 1000000)
    ) {
      return text("dailyRequestLimit 需在 1-1000000 之间", 400);
    }
    const blacklist = sanitizeList(b.blacklist);
    const asnBlacklist = sanitizeList(b.asnBlacklist);
    const fingerprintBlacklist = sanitizeList(b.fingerprintBlacklist);
    const whitelist = sanitizeList(b.whitelist);
    if ([blacklist, asnBlacklist, fingerprintBlacklist, whitelist].some((l) => l.length > MAX_BLACKLIST_SIZE)) {
      return text(`列表长度不能超过 ${MAX_BLACKLIST_SIZE}`, 400);
    }
    for (const item of whitelist) {
      if (/[\^$.*+?\[\]{}()|\\]/.test(item)) {
        try {
          new RegExp(item);
        } catch {
          return text(`无效的正则: ${item}`, 400);
        }
      }
    }
    const settings = {
      enabled: b.enabled === undefined ? false : b.enabled,
      blacklist,
      asnBlacklist,
      fingerprintBlacklist,
      enableWhitelist: b.enableWhitelist === undefined ? false : b.enableWhitelist,
      whitelist,
      enableDailyLimit: b.enableDailyLimit === undefined ? false : b.enableDailyLimit,
      dailyRequestLimit: b.dailyRequestLimit === undefined ? 1000 : b.dailyRequestLimit,
    };
    await saveSetting(env, CONSTANTS.IP_BLACKLIST_SETTINGS_KEY, JSON.stringify(settings));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}