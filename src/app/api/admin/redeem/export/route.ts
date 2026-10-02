import { NextRequest } from "next/server";
import { getEnv, text, ApiError, requireAdmin } from "@/lib/server";
import { exportRedeemCodes, requireRedeemCodeEnabled } from "@/lib/redeem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/redeem/export?redeem_type=&limit= —— 导出兑换码 CSV */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    requireRedeemCodeEnabled(env);
    const { searchParams } = new URL(req.url);
    const csv = await exportRedeemCodes(env, searchParams);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}