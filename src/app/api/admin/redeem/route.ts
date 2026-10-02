import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { listRedeemCodes, createRedeemCodes, updateRedeemCode, deleteRedeemCode, requireRedeemCodeEnabled } from "@/lib/redeem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/redeem?redeem_type=role&limit=20&offset=0&query=  —— 兑换码列表 */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    requireRedeemCodeEnabled(env);
    const { searchParams } = new URL(req.url);
    const data = await listRedeemCodes(env, searchParams);
    return json(data);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** POST /api/admin/redeem —— 批量创建兑换码
 * body: { count, redeem_type, value, enabled, expires_at }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    requireRedeemCodeEnabled(env);
    const body = (await req.json().catch(() => ({}))) as {
      count?: unknown;
      redeem_type?: unknown;
      value?: unknown;
      enabled?: unknown;
      expires_at?: unknown;
    };
    const data = await createRedeemCodes(env, body);
    return json(data);
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** DELETE /api/admin/redeem?id=xxx —— 删除兑换码 */
export async function DELETE(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    requireRedeemCodeEnabled(env);
    const { searchParams } = new URL(req.url);
    await deleteRedeemCode(env, searchParams.get("id"));
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}

/** PUT /api/admin/redeem?id=xxx —— 更新兑换码
 * body: { redeem_type, value, enabled, expires_at }
 */
export async function PUT(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    requireRedeemCodeEnabled(env);
    const { searchParams } = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as {
      redeem_type?: unknown;
      value?: unknown;
      enabled?: unknown;
      expires_at?: unknown;
    };
    await updateRedeemCode(env, searchParams.get("id"), body);
    return json({ success: true });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}
