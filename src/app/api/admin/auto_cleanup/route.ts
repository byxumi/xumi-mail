import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getJsonSetting, saveSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";
import { cleanup } from "@/lib/address";
import { CleanupSettings } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 读取自动清理设置 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = await getJsonSetting<CleanupSettings>(env, CONSTANTS.AUTO_CLEANUP_KEY);
    return json(settings || { cleanMailsDays: 7, cleanUnknowMailsDays: 7, cleanSendBoxDays: 7, cleanAddressDays: 30, cleanInactiveAddressDays: 30, cleanUnboundAddressDays: 7, cleanEmptyAddressDays: 7 });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 校验自定义清理 SQL（对齐上游 cleanup_api：空/过长/非 DELETE/含分号/含注释均拒绝） */
function validateCustomSql(name: string, sql: string): string | null {
  if (!sql || !sql.trim()) return "sql 不能为空";
  const normalized = sql.trim();
  if (normalized.length > 1000) return "sql 过长（最多 1000 字符）";
  if (!/^DELETE\s+/i.test(normalized)) return "sql 必须以 DELETE 开头";
  if (normalized.includes(";")) return "sql 不能包含分号";
  if (normalized.includes("--") || normalized.includes("/*")) return "sql 不能包含注释";
  return null;
}

/** 保存自动清理设置（含 customSqlCleanupList 校验） */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const settings = (await req.json().catch(() => ({}))) as CleanupSettings;
    const customList = settings.customSqlCleanupList ?? [];
    if (!Array.isArray(customList)) return text("customSqlCleanupList 必须为数组", 400);
    for (const item of customList) {
      const err = validateCustomSql(item.name ?? "", item.sql ?? "");
      if (err) return text(`[${item.name ?? "unnamed"}]: ${err}`, 400);
    }
    await saveSetting(env, CONSTANTS.AUTO_CLEANUP_KEY, JSON.stringify(settings));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** 手动清理 */
export async function PUT(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { cleanType, cleanDays } = (await req.json().catch(() => ({}))) as {
      cleanType?: string;
      cleanDays?: number;
    };
    if (!cleanType || typeof cleanDays !== "number") {
      return text("缺少 cleanType / cleanDays", 400);
    }
    const success = await cleanup(env, cleanType, cleanDays);
    return json({ success });
  } catch (e) {
    return text(`清理失败: ${(e as Error).message}`, 400);
  }
}