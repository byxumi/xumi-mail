import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { cleanup } from "@/lib/address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/admin/cleanup —— 立即清理（Maintenance.vue）
 * body: { cleanType, cleanDays }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const body = (await req.json().catch(() => ({}))) as {
      cleanType?: string;
      cleanDays?: number;
    };
    if (!body.cleanType || typeof body.cleanType !== "string") {
      return text("缺少清理类型", 400);
    }
    const cleanDays = Number(body.cleanDays);
    if (!Number.isFinite(cleanDays) || cleanDays < 0) {
      return text("无效的清理天数", 400);
    }
    await cleanup(env, body.cleanType, cleanDays);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}