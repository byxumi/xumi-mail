import { NextRequest } from "next/server";
import { getEnv, json, text } from "@/lib/server";
import { verifyAddressJwtWithDb } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /open_api/credential_login —— 地址凭证验证（compat 上游语义）
 * body: { credential: string (地址 JWT), cf_token? }
 */
export async function POST(req: NextRequest) {
  try {
    const env = await getEnv();
    const body = (await req.json().catch(() => ({}))) as { credential?: string; cf_token?: string };
    if (!body.credential) {
      return text("地址凭证无效", 401);
    }
    const payload = await verifyAddressJwtWithDb(env, body.credential);
    if (!payload) {
      return text("地址凭证无效", 401);
    }
    return json({ success: true });
  } catch (e) {
    console.error("credential_login error:", e);
    return text("服务器错误", 500);
  }
}