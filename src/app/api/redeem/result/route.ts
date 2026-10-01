import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { queryRedeemResult } from "@/lib/redeem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/redeem/result —— 查询兑换结果（上游 /redeem_api/result 重写目标）
 * body: { code }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const result = await queryRedeemResult(env, body.code);
    return json(result);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}