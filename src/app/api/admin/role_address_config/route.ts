import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin, readJson } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/role_address_config —— 角色地址配额配置（RoleAddressConfig.vue） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const configs = (await getJsonSetting<any>(env, CONSTANTS.ROLE_ADDRESS_CONFIG_KEY)) || {};
    return json({ configs });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** POST /api/admin/role_address_config —— 保存角色地址配额配置 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await readJson(req)) as any;
    if (!body || typeof body !== "object" || !body.configs || Array.isArray(body.configs) || typeof body.configs !== "object") {
      return text("请求体无效", 400);
    }
    for (const [role, cfg] of Object.entries(body.configs)) {
      const c = cfg as any;
      if (c && typeof c === "object" && c.maxAddressCount !== undefined) {
        if (typeof c.maxAddressCount !== "number" || !Number.isInteger(c.maxAddressCount) || c.maxAddressCount < 0) {
          return text("maxAddressCount 必须为非负整数", 400);
        }
      }
      void role;
    }
    await saveSetting(env, CONSTANTS.ROLE_ADDRESS_CONFIG_KEY, JSON.stringify(body.configs));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}