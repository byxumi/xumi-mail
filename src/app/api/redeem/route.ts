import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError } from "@/lib/server";
import { redeemCode, requireRedeemCodeEnabled } from "@/lib/redeem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/redeem —— 用户兑换兑换码
 * body: { code, user_email?, address?, name?, domain?, enableRandomSubdomain? }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireRedeemCodeEnabled(env);
    const body = (await req.json().catch(() => ({}))) as {
      code?: unknown;
      user_email?: unknown;
      address?: unknown;
      name?: string;
      domain?: string;
      enableRandomSubdomain?: boolean | string;
    };
    if (!body.code) {
      return text("请输入兑换码", 400);
    }
    const result = await redeemCode(env, body);
    return json(result);
  } catch (e) {
    console.error("redeem error:", e);
    if (e instanceof ApiError) return text(e.message, e.status);
    return text(`兑换失败: ${(e as Error).message}`, 400);
  }
}
