import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting, deleteSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";
import { getBooleanValue, getDomains } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/account_settings —— 账户级设置总览（AccountSettings.vue）
 *  POST /api/admin/account_settings —— 保存（blockList/sendBlockList/verifiedAddressList/emailRuleSettings/...）
 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const [blockList, sendBlockList, verifiedAddressList, emailRuleSettings, noLimitSendAddressList] =
      await Promise.all([
        getJsonSetting<string[]>(env, CONSTANTS.ADDRESS_BLOCK_LIST_KEY).then((v) => v ?? []),
        getJsonSetting<string[]>(env, CONSTANTS.SEND_BLOCK_LIST_KEY).then((v) => v ?? []),
        getJsonSetting<string[]>(env, CONSTANTS.VERIFIED_ADDRESS_LIST_KEY).then((v) => v ?? []),
        getJsonSetting<any>(env, CONSTANTS.EMAIL_RULE_SETTINGS_KEY).then((v) => v ?? {}),
        getJsonSetting<string[]>(env, CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY).then((v) => v ?? []),
      ]);
    const fromBlockList = env.KV
      ? ((await env.KV.get(CONSTANTS.EMAIL_KV_BLACK_LIST, "json")) as string[] | null) || []
      : [];
    const addressCreationSettings =
      (await getJsonSetting<any>(env, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY)) ?? {};
    const envConfigured = getBooleanValue(env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH);
    const envEnabled = envConfigured || getDomains(env).some((d) => d.startsWith("*."));
    const storedEnabled =
      addressCreationSettings && typeof addressCreationSettings.enableSubdomainMatch === "boolean"
        ? addressCreationSettings.enableSubdomainMatch
        : null;
    const effectiveEnabled = storedEnabled === null ? envEnabled : storedEnabled;
    return json({
      blockList,
      sendBlockList,
      verifiedAddressList,
      fromBlockList,
      emailRuleSettings,
      noLimitSendAddressList,
      addressCreationSettings,
      addressCreationSubdomainMatchStatus: { envConfigured, envEnabled, storedEnabled, effectiveEnabled },
      sendMailLimitConfig: null,
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    // 保存各项设置
    const saves: Promise<unknown>[] = [];
    for (const key of [
      CONSTANTS.ADDRESS_BLOCK_LIST_KEY,
      CONSTANTS.SEND_BLOCK_LIST_KEY,
      CONSTANTS.VERIFIED_ADDRESS_LIST_KEY,
      CONSTANTS.EMAIL_RULE_SETTINGS_KEY,
      CONSTANTS.NO_LIMIT_SEND_ADDRESS_LIST_KEY,
    ]) {
      if (body[key] !== undefined) saves.push(saveSetting(env, key, JSON.stringify(body[key])));
    }
    if (body.fromBlockList !== undefined && env.KV) {
      saves.push(env.KV.put(CONSTANTS.EMAIL_KV_BLACK_LIST, JSON.stringify(body.fromBlockList)));
    }
    const addressCreation = body.addressCreationSettings;
    if (addressCreation !== undefined) {
      if (addressCreation === null) {
        saves.push(deleteSetting(env, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY));
      } else if (typeof addressCreation === "object") {
        const current =
          (await getJsonSetting<any>(env, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY)) ?? {};
        saves.push(
          saveSetting(env, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY, JSON.stringify({ ...current, ...addressCreation }))
        );
      } else if (typeof addressCreation === "boolean") {
        saves.push(saveSetting(env, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY, JSON.stringify({ enableSubdomainMatch: addressCreation })));
      } else {
        return text("无效的 addressCreationSettings", 400);
      }
    }
    await Promise.all(saves);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}